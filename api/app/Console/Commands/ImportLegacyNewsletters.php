<?php

namespace App\Console\Commands;

use App\Models\NewsletterIssue;
use App\Support\LegacyNewsletter;
use Illuminate\Console\Command;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Migrates the newsletter archive exported from the old regis.ph CMS —
 * a `newsletter-index.csv` beside Daily/Weekly/Monthly/<year>/ folders of
 * .html mailers — into `newsletter_issues`.
 *
 *   php artisan newsletters:import-legacy ../Newsletters --fresh
 *
 * Each issue keeps its old id in `legacy_id`, so re-running updates in
 * place. Chart images the mailers load from regis.ph are copied into the
 * media store so the archive outlives the old site; a copy that fails
 * keeps the original URL and is listed at the end.
 */
class ImportLegacyNewsletters extends Command
{
    protected $signature = 'newsletters:import-legacy
        {dir : Folder holding newsletter-index.csv and the Daily/Weekly/Monthly trees}
        {--fresh : Delete every existing issue before importing}
        {--include-tests : Also import the old system\'s test and "Copy of" issues}
        {--no-images : Leave chart images pointing at regis.ph instead of copying them}
        {--only= : Comma-separated legacy ids to import}
        {--limit= : Stop after this many issues}';

    protected $description = 'Import the legacy regis.ph newsletter archive into the newsletter desk';

    private const IMAGE_DIR = 'site/newsletter-legacy';

    private const MANIFEST = 'newsletter-legacy-images.json';

    private const CADENCES = ['Daily' => 'daily', 'Weekly' => 'weekly', 'Monthly' => 'monthly'];

    /** url => stored src, loaded from and saved back to the manifest. */
    private array $manifest = [];

    private array $failedImages = [];

    private int $copied = 0;

    public function handle(): int
    {
        $dir = rtrim(str_replace('\\', '/', (string) $this->argument('dir')), '/');
        $csv = $dir.'/newsletter-index.csv';
        if (! is_file($csv)) {
            $this->error("No newsletter-index.csv in {$dir}");

            return self::FAILURE;
        }

        $rows = $this->readIndex($csv);
        $skipped = [];

        if (! $this->option('include-tests')) {
            [$rows, $skipped] = $this->partitionTests($rows);
        }
        if ($only = $this->option('only')) {
            $ids = array_map('intval', explode(',', $only));
            $rows = array_values(array_filter($rows, static fn (array $r): bool => in_array((int) $r['id'], $ids, true)));
        }
        if ($limit = (int) $this->option('limit')) {
            $rows = array_slice($rows, 0, $limit);
        }

        if ($this->option('fresh')) {
            $gone = NewsletterIssue::query()->delete();
            $this->info("Removed {$gone} existing issue(s).");
        }

        $copyImages = ! $this->option('no-images');
        if ($copyImages) {
            $this->manifest = json_decode((string) Storage::disk('local')->get(self::MANIFEST), true) ?: [];
        }

        $this->line(sprintf('Importing %d issue(s) from %s', count($rows), $dir));
        $bar = $this->output->createProgressBar(count($rows));
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');
        $bar->setMessage('');
        $bar->start();

        $counts = ['daily' => 0, 'weekly' => 0, 'monthly' => 0];
        $warnings = [];

        foreach ($rows as $row) {
            $cadence = self::CADENCES[$row['type']] ?? null;
            $file = $dir.'/'.$row['file'];
            $bar->setMessage(substr($row['subject'], 0, 60));

            if ($cadence === null || ! is_file($file)) {
                $warnings[] = "#{$row['id']}: missing file {$row['file']}";
                $bar->advance();
                continue;
            }

            try {
                $parsed = LegacyNewsletter::parse((string) file_get_contents($file), $cadence);
            } catch (Throwable $e) {
                $warnings[] = "#{$row['id']}: parse failed — {$e->getMessage()}";
                $bar->advance();
                continue;
            }

            foreach ($parsed['warnings'] as $w) {
                $warnings[] = "#{$row['id']} ({$row['type']} {$row['date']}): {$w}";
            }
            if ($copyImages) {
                $parsed = $this->localizeImages($parsed);
            }

            $issue = NewsletterIssue::updateOrCreate(
                ['legacy_id' => (int) $row['id']],
                [
                    'cadence' => $cadence,
                    'date' => $row['date'],
                    'subject' => mb_substr(trim($row['subject']), 0, 300),
                    'intro' => $parsed['intro'],
                    'sections' => $parsed['sections'],
                    'rail' => $parsed['rail'],
                ],
            );

            // Keep the desk's own filing dates rather than today's.
            $issue->timestamps = false;
            $issue->created_at = $row['created'] ?: $row['date'];
            $issue->updated_at = $row['modified'] ?: ($row['created'] ?: $row['date']);
            $issue->save();

            $counts[$cadence]++;
            $bar->advance();

            // Checkpoint the image manifest so an interrupted run keeps its copies.
            if ($copyImages && array_sum($counts) % 25 === 0) {
                $this->saveManifest();
            }
        }

        $bar->setMessage('done');
        $bar->finish();
        $this->newLine(2);

        if ($copyImages) {
            $this->saveManifest();
        }

        $this->table(['Cadence', 'Imported'], [
            ['Daily', $counts['daily']],
            ['Weekly', $counts['weekly']],
            ['Monthly', $counts['monthly']],
            ['Total', array_sum($counts)],
        ]);

        if ($copyImages) {
            $this->line(sprintf('Images: %d copied this run, %d cached, %d failed.', $this->copied, count($this->manifest), count($this->failedImages)));
        }
        if ($skipped) {
            $this->line(sprintf('Skipped %d test/"Copy of" issue(s) (pass --include-tests to import them):', count($skipped)));
            foreach ($skipped as $r) {
                $this->line("  #{$r['id']} {$r['type']} {$r['date']}  {$r['subject']}");
            }
        }
        if ($warnings) {
            $this->newLine();
            $this->warn(count($warnings).' warning(s):');
            foreach ($warnings as $w) {
                $this->line('  '.$w);
            }
        }
        if ($this->failedImages) {
            $this->newLine();
            $this->warn(count($this->failedImages).' image(s) could not be copied and still point at regis.ph:');
            foreach (array_slice($this->failedImages, 0, 40) as $url => $why) {
                $this->line("  {$url}  ({$why})");
            }
            if (count($this->failedImages) > 40) {
                $this->line('  …');
            }
        }

        return self::SUCCESS;
    }

    private function saveManifest(): void
    {
        Storage::disk('local')->put(self::MANIFEST, json_encode($this->manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    /* ── Index ─────────────────────────────────────────────────── */

    /** @return array<int, array<string,string>> */
    private function readIndex(string $csv): array
    {
        $fh = fopen($csv, 'rb');
        $header = fgetcsv($fh);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // BOM
        $rows = [];
        while (($line = fgetcsv($fh)) !== false) {
            if (count($line) !== count($header)) {
                continue;
            }
            $rows[] = array_combine($header, $line);
        }
        fclose($fh);

        usort($rows, static fn (array $a, array $b): int => [$a['date'], (int) $a['id']] <=> [$b['date'], (int) $b['id']]);

        return $rows;
    }

    /** The old CMS kept its template tests and duplicate drafts; keep them out of the desk. */
    private function partitionTests(array $rows): array
    {
        $keep = [];
        $skip = [];
        foreach ($rows as $r) {
            if (preg_match('/\btest\b|^copy of\b/i', $r['subject'])) {
                $skip[] = $r;
            } else {
                $keep[] = $r;
            }
        }

        return [$keep, $skip];
    }

    /* ── Images ────────────────────────────────────────────────── */

    /** Copy every remote image the issue references and point the document at the copies. */
    private function localizeImages(array $parsed): array
    {
        $urls = [];
        $collect = static function (string $html) use (&$urls): void {
            if (preg_match_all('/<img[^>]+src="([^"]+)"/i', $html, $m)) {
                foreach ($m[1] as $src) {
                    $urls[] = html_entity_decode($src, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
            }
        };

        $collect($parsed['intro']);
        foreach ($parsed['sections'] as $s) {
            $collect($s['body']);
            $collect($s['aside']);
            foreach ($s['images'] as $src) {
                $urls[] = $src;
            }
        }
        foreach ($parsed['rail'] as $b) {
            $urls[] = $b['image'];
        }

        $remote = array_values(array_unique(array_filter($urls, static fn (string $u): bool => preg_match('#^https?://#i', $u) === 1)));
        $map = $this->resolve($remote);
        if ($map === []) {
            return $parsed;
        }

        $swap = static function (string $html) use ($map): string {
            return preg_replace_callback('/(<img[^>]+src=")([^"]+)(")/i', static function (array $m) use ($map): string {
                $url = html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');

                return $m[1].htmlspecialchars($map[$url] ?? $url, ENT_QUOTES, 'UTF-8').$m[3];
            }, $html) ?? $html;
        };

        $parsed['intro'] = $swap($parsed['intro']);
        foreach ($parsed['sections'] as &$s) {
            $s['body'] = $swap($s['body']);
            $s['aside'] = $swap($s['aside']);
            $s['images'] = array_map(static fn (string $u): string => $map[$u] ?? $u, $s['images']);
        }
        unset($s);
        foreach ($parsed['rail'] as &$b) {
            $b['image'] = $map[$b['image']] ?? $b['image'];
        }
        unset($b);

        return $parsed;
    }

    /**
     * url => local src for every URL that is (or becomes) stored. Misses
     * are fetched together; a failure is reported and left remote.
     *
     * @param  string[]  $urls
     * @return array<string,string>
     */
    private function resolve(array $urls): array
    {
        $map = [];
        $pending = [];
        foreach ($urls as $url) {
            if (isset($this->manifest[$url])) {
                $map[$url] = $this->manifest[$url];
            } elseif (! isset($this->failedImages[$url])) {
                $pending[] = $url;
            }
        }

        foreach (array_chunk($pending, 16) as $chunk) {
            $responses = Http::pool(function (Pool $pool) use ($chunk): void {
                foreach ($chunk as $url) {
                    // Spaces in the old upload names have to be encoded by hand.
                    $pool->as($url)->timeout(25)->retry(1, 300)->get(str_replace(' ', '%20', $url));
                }
            });

            foreach ($chunk as $url) {
                $res = $responses[$url] ?? null;
                if (! $res instanceof Response) {
                    $this->failedImages[$url] = $res instanceof Throwable ? $res->getMessage() : 'no response';
                    continue;
                }
                $type = strtolower((string) $res->header('Content-Type'));
                if (! $res->successful() || ! str_starts_with($type, 'image/')) {
                    $this->failedImages[$url] = $res->successful() ? "not an image ({$type})" : 'HTTP '.$res->status();
                    continue;
                }

                $ext = match (true) {
                    str_contains($type, 'png') => 'png',
                    str_contains($type, 'jpeg'), str_contains($type, 'jpg') => 'jpg',
                    str_contains($type, 'gif') => 'gif',
                    str_contains($type, 'webp') => 'webp',
                    default => strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION)) ?: 'png',
                };
                $path = self::IMAGE_DIR.'/'.sha1($url).'.'.$ext;
                Storage::disk('public')->put($path, $res->body());

                $src = '/api/media/'.$path;
                $this->manifest[$url] = $src;
                $map[$url] = $src;
                $this->copied++;
            }
        }

        return $map;
    }
}
