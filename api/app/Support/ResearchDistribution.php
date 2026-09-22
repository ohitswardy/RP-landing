<?php

namespace App\Support;

use App\Models\Crms\Corporate;
use App\Models\Crms\SectorGroup;
use Illuminate\Support\Collection;

/**
 * The research distribution hierarchy the client dictated (CRMSmasterplan.md
 * §7.8): Research-Domestics and Research-Foreign, each a fixed run of sectors
 * with the tickers covered under them. The two audiences are NOT the same
 * list — domestic property carries the REITs (AREIT, RCR) and mining adds
 * APX, while foreign keeps FLI/VLL and consumer adds Emperador.
 *
 * Tickers are written here the way the client writes them; the legacy
 * `corporate` table is noisier (`APX PM`, `CREIT.PS`, trailing spaces, and
 * Emperador still filed under its post-2022 symbol EMP), so resolution
 * normalises both sides and keeps an alias table for the rest.
 */
class ResearchDistribution
{
    /** Sector => tickers, in the order the client listed them, per audience. */
    public const SPEC = [
        'domestic' => [
            'Strategy' => [],
            'Banks' => ['BPI', 'BDO', 'MBT', 'SECB'],
            'Property' => ['ALI', 'SMPH', 'AREIT', 'MEG', 'RLC', 'RCR'],
            'Power & Utilities' => ['ACEN', 'AP', 'FGEN', 'MWC', 'MER', 'SCC'],
            'Telecommunications' => ['CNVRG', 'GLO', 'TEL'],
            'Consumer' => ['CNPF', 'JFC', 'MONDE', 'PGOLD', 'RRHI', 'FB', 'SEVN', 'PIZZA', 'URC', 'WLCON'],
            'Gaming & Leisure' => ['BLOOM'],
            'Mining' => ['NIKL', 'APX'],
            'Conglomerates' => ['AGI', 'AC', 'DMC', 'GTCAP', 'LTG', 'SM'],
            'Transportation' => ['CEB', 'ICT'],
        ],
        'foreign' => [
            'Strategy' => [],
            'Banks' => ['BPI', 'BDO', 'MBT', 'SECB'],
            'Property' => ['ALI', 'SMPH', 'FLI', 'MEG', 'RLC', 'VLL'],
            'Power & Utilities' => ['ACEN', 'AP', 'FGEN', 'MWC', 'MER', 'SCC'],
            'Telecommunications' => ['CNVRG', 'GLO', 'TEL'],
            'Consumer' => ['CNPF', 'EMI', 'JFC', 'MONDE', 'PGOLD', 'RRHI', 'FB', 'SEVN', 'PIZZA', 'URC', 'WLCON'],
            'Gaming & Leisure' => ['BLOOM'],
            'Mining' => ['NIKL'],
            'Conglomerates' => ['AGI', 'AC', 'DMC', 'GTCAP', 'LTG', 'SM'],
            'Transportation' => ['CEB', 'ICT'],
        ],
    ];

    /**
     * Symbols the client uses that the legacy table files differently. The
     * value is the `corporate` ticker; the comment is only there to explain it.
     */
    public const ALIASES = [
        'EMI' => 'EMP',   // Emperador renamed EMI -> EMP in 2022; the dump kept EMP.
    ];

    /** Exchange suffixes some legacy tickers carry. */
    private const SUFFIXES = [' PM', ' PS', '.PS', '.PM', ' EQUITY'];

    /** `APX PM`, `CREIT.PS`, `GSMI ` all collapse onto their bare symbol. */
    public static function normalise(?string $ticker): string
    {
        $t = strtoupper(trim((string) $ticker));
        $t = (string) preg_replace('/\s+/', ' ', $t);
        foreach (self::SUFFIXES as $suffix) {
            if ($t !== $suffix && str_ends_with($t, $suffix)) {
                return trim(substr($t, 0, -strlen($suffix)));
            }
        }

        return $t;
    }

    /** Normalised ticker => corporate id; for a duplicated symbol the lowest id wins. */
    public static function corporateIndex(): Collection
    {
        $index = collect();
        Corporate::query()
            ->whereNotNull('ticker')->where('ticker', '<>', '')
            ->orderBy('id')->get(['id', 'ticker'])
            ->each(function (Corporate $c) use ($index) {
                $key = self::normalise($c->ticker);
                if ($key !== '' && ! $index->has($key)) {
                    $index->put($key, (int) $c->id);
                }
            });

        return $index;
    }

    /**
     * One audience's spec resolved against the corporates on hand.
     *
     * @return array<int, array{name: string, position: int, tickers: array<int, string>, corporateIds: array<int, int>, missing: array<int, string>}>
     */
    public static function resolve(string $scope, ?Collection $index = null): array
    {
        $index ??= self::corporateIndex();
        $out = [];
        $position = 0;
        foreach (self::SPEC[$scope] ?? [] as $name => $tickers) {
            $ids = [];
            $missing = [];
            foreach ($tickers as $ticker) {
                $id = $index->get(self::normalise(self::ALIASES[$ticker] ?? $ticker));
                if ($id === null) {
                    $missing[] = $ticker;
                } else {
                    $ids[] = $id;
                }
            }
            $out[] = ['name' => $name, 'position' => $position++, 'tickers' => $tickers, 'corporateIds' => $ids, 'missing' => $missing];
        }

        return $out;
    }

    /**
     * Write the hierarchy. Missing sectors are created and every sector's
     * position is pulled back into the client's order; tickers are only
     * rewritten when the sector is still empty, unless `$force` — an
     * Administrator's later edits in the CRMS are theirs to keep.
     *
     * @return array<int, array{scope: string, name: string, action: string, tickers: int, missing: array<int, string>}>
     */
    public static function apply(bool $force = false, bool $dryRun = false): array
    {
        $index = self::corporateIndex();
        $log = [];

        foreach (array_keys(self::SPEC) as $scope) {
            foreach (self::resolve($scope, $index) as $sector) {
                $group = SectorGroup::where('scope', $scope)->where('name', $sector['name'])->first();
                $action = $group ? 'kept' : 'created';
                $empty = ! $group || $group->corporates()->count() === 0;

                if (! $dryRun) {
                    $group ??= new SectorGroup(['name' => $sector['name'], 'scope' => $scope]);
                    $group->position = $sector['position'];
                    $group->save();
                }

                if ($sector['corporateIds'] !== [] && ($force || $empty)) {
                    $action = $action === 'created' ? 'created' : 'retagged';
                    if (! $dryRun) {
                        $group->corporates()->sync($sector['corporateIds']);
                    }
                }

                $log[] = [
                    'scope' => $scope,
                    'name' => $sector['name'],
                    'action' => $dryRun ? 'would be '.$action : $action,
                    'tickers' => count($sector['corporateIds']),
                    'missing' => $sector['missing'],
                ];
            }
        }

        return $log;
    }

    /** Sector groups in the database that the spec does not describe. */
    public static function strays(): Collection
    {
        return SectorGroup::all()->reject(fn (SectorGroup $g) => isset(self::SPEC[$g->scope][$g->name]))->values();
    }
}
