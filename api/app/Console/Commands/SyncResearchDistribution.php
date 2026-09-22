<?php

namespace App\Console\Commands;

use App\Support\ResearchDistribution;
use Illuminate\Console\Command;

/**
 * Push the client's Research-Domestics / Research-Foreign hierarchy onto the
 * CRMS database. Safe by default: it creates the sectors that are missing and
 * fixes their order, but only tags a sector that is still empty. `--force`
 * rewrites every sector's tickers back to the spec, which is what you want
 * after a fresh dump import or when the taxonomy has drifted.
 */
class SyncResearchDistribution extends Command
{
    protected $signature = 'crms:distribution-list {--force : Rewrite the tickers of sectors that already carry some} {--dry-run : Print what would change and write nothing}';

    protected $description = 'Sync the research distribution hierarchy (sectors and their tickers) from the client spec';

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $dry = (bool) $this->option('dry-run');

        $log = ResearchDistribution::apply($force, $dry);
        $missing = [];

        $this->table(
            ['Audience', 'Sector', 'Action', 'Tickers', 'Not in corporate'],
            collect($log)->map(function (array $row) use (&$missing) {
                $missing = array_unique([...$missing, ...$row['missing']]);

                return [
                    $row['scope'] === 'domestic' ? 'Research-Domestics' : 'Research-Foreign',
                    $row['name'],
                    $row['action'],
                    $row['tickers'] ?: ($row['name'] === 'Strategy' ? '— sector-wide' : '0'),
                    $row['missing'] ? implode(', ', $row['missing']) : '',
                ];
            })->all()
        );

        if ($missing !== []) {
            $this->warn('No corporate row matches: '.implode(', ', $missing).'. Add the issuer under Corporates, then re-run with --force.');
        }

        $strays = ResearchDistribution::strays();
        if ($strays->isNotEmpty()) {
            $this->line('Left untouched (not in the spec): '.$strays->map(fn ($g) => $g->scope.' · '.$g->name)->implode(', '));
        }

        if ($dry) {
            $this->info('Dry run — nothing was written.');
        } elseif (! $force) {
            $this->line('Sectors that already carried tickers were left alone; re-run with --force to overwrite them.');
        }

        return self::SUCCESS;
    }
}
