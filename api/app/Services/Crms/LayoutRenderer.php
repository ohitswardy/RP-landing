<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Interaction;
use App\Models\Crms\ReportTemplate;
use App\Support\XlsxTemplate;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Fills a client's own Excel workbook with the interactions in range on a
 * column → source map: the bundled Jefferies / Schroders / JPM templates
 * (BundledTemplates) or one imported from the Form builder. The design is
 * the client's, untouched; the rows are the CRMS's.
 */
class LayoutRenderer
{
    public function __construct(private ReportSources $sources = new ReportSources) {}

    /** An imported template: its stored workbook filled on its stored map. Returns the finished file's path. */
    public function render(ReportTemplate $template, Collection $rows, ?Client $client, string $generatedBy, string $from, string $to): string
    {
        $layout = $template->layout;
        if (! is_array($layout) || ! $template->layout_file) {
            throw new RuntimeException('This client has no imported template.');
        }
        $disk = Storage::disk('local');
        if (! $disk->exists($template->layout_file)) {
            throw new RuntimeException('The imported template workbook is missing from the server. Import it again from the Form builder.');
        }

        return $this->renderFile($disk->path($template->layout_file), $layout, $rows, $client, $generatedBy, $from, $to);
    }

    /** A bundled template by key. */
    public function renderBundled(string $key, Collection $rows, ?Client $client, string $generatedBy, string $from, string $to): string
    {
        $path = BundledTemplates::path($key);
        if (! is_file($path)) {
            throw new RuntimeException('The bundled template "'.BundledTemplates::FILES[$key].'" is missing from resources/report-templates.');
        }

        return $this->renderFile($path, BundledTemplates::layout($key), $rows, $client, $generatedBy, $from, $to);
    }

    /**
     * Fill the workbook at $path on $layout and return the path of the
     * finished copy (a temp file the caller streams and deletes).
     */
    public function renderFile(string $path, array $layout, Collection $rows, ?Client $client, string $generatedBy, string $from, string $to): string
    {
        $this->sources->begin($client, $generatedBy, $from, $to);
        $book = XlsxTemplate::open($path);

        $cells = [];
        foreach ($layout['cells'] ?? [] as $c) {
            $cells[(string) $c['ref']] = $this->sources->meta((string) $c['source'], $c['text'] ?? null);
        }

        $columns = array_values($layout['columns'] ?? []);
        $book->fill((string) $layout['sheet'], (int) $layout['headerRow'], (int) $layout['dataStart'], $this->rows($columns, $rows), $cells);

        $out = tempnam(sys_get_temp_dir(), 'xlsx');
        $book->save($out);

        return $out;
    }

    /** @return \Generator<array<int, array{v: mixed, kind: string, format?: ?string}>> */
    private function rows(array $columns, Collection $rows): \Generator
    {
        foreach ($rows as $i) {
            $line = [];
            foreach ($columns as $c) {
                $line[(int) $c['index']] = $this->cell($c, $i);
            }
            yield $line;
        }
    }

    /**
     * One cell for the workbook writer: the resolved value plus the kind
     * that decides how it is written (a real date / time / number, text,
     * or the template's own formula).
     *
     * @param  array{source: string, separator?: ?string, format?: ?string, text?: ?string}  $c
     * @return array{v: mixed, kind: string, format?: ?string}
     */
    public function cell(array $c, Interaction $i): array
    {
        $source = (string) $c['source'];
        if ($source === 'blank') {
            return ['v' => null, 'kind' => 'text'];
        }
        if ($source === 'formula') {
            return ['v' => null, 'kind' => 'formula'];
        }
        if (! ReportSources::isValid($source)) {
            return ['v' => null, 'kind' => 'text'];
        }
        $value = $this->sources->resolve($source, $i, $c['text'] ?? null);
        if (is_array($value)) {
            $value = implode((string) ($c['separator'] ?? ', '), array_filter(array_map('strval', $value), fn ($v) => $v !== ''));
        }
        $format = isset($c['format']) && $c['format'] !== '' ? (string) $c['format'] : null;

        return ['v' => $value, 'kind' => ReportSources::kind($source), 'format' => $format];
    }

    /** The preview text of one cell. */
    public function display(array $c, Interaction $i): string
    {
        return $this->sources->display((string) $c['source'], $i, (string) ($c['separator'] ?? ', '), $c['text'] ?? null);
    }
}
