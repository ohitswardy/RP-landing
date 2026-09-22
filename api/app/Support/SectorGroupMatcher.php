<?php

namespace App\Support;

use App\Models\Report;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * The CRMS side of the Email desk matcher. A report's company is matched
 * to a CRMS corporate (by ticker, else exact name); every sector group
 * that corporate belongs to names the client contacts subscribed to it;
 * the contacts linked to a portal account (client_contact.portal_user_id)
 * yield the CMS user ids. Read-only over the `crms` connection, and inert
 * when that database is empty or its tables are not there yet.
 */
class SectorGroupMatcher
{
    private const TABLES = ['corporate', 'sector_group_corporate', 'client_contact_sector_group', 'client_contact'];

    /**
     * Portal user ids of the clients whose CRMS contact sits in a sector
     * group containing the report's company.
     *
     * @return array<int, int>
     */
    public static function portalUserIdsFor(Report $report): array
    {
        $company = $report->company;
        if (! $company) {
            return [];
        }

        try {
            if (! self::available()) {
                return [];
            }

            $db = DB::connection('crms');

            $corporateIds = $db->table('corporate')
                ->where(function ($q) use ($company) {
                    $symbol = trim((string) $company->symbol);
                    if ($symbol !== '') {
                        // Legacy rows carry exchange suffixes (`APX PM`, `CREIT.PS`),
                        // so the report's bare symbol is matched against both forms.
                        $q->orWhereIn(DB::raw('LOWER(TRIM(ticker))'), self::tickerForms($symbol));
                    }
                    $q->orWhereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim((string) $company->name))]);
                })
                ->pluck('id')
                ->all();
            if ($corporateIds === []) {
                return [];
            }

            $groupIds = $db->table('sector_group_corporate')
                ->whereIn('corporate_id', $corporateIds)
                ->pluck('sector_group_id')
                ->unique()
                ->all();
            if ($groupIds === []) {
                return [];
            }

            $contactIds = $db->table('client_contact_sector_group')
                ->whereIn('sector_group_id', $groupIds)
                ->pluck('client_contact_id')
                ->unique()
                ->all();
            if ($contactIds === []) {
                return [];
            }

            return $db->table('client_contact')
                ->whereIn('id', $contactIds)
                ->whereNotNull('portal_user_id')
                ->pluck('portal_user_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();
        } catch (Throwable) {
            // An unreachable or half-migrated CRMS database must never break the desk.
            return [];
        }
    }

    /**
     * The spellings a bare symbol may take in the legacy `corporate` table,
     * lower-cased for the comparison.
     *
     * @return array<int, string>
     */
    private static function tickerForms(string $symbol): array
    {
        $bare = mb_strtolower(trim($symbol));

        return array_values(array_unique([$bare, $bare.' pm', $bare.' ps', $bare.'.ps', $bare.'.pm']));
    }

    private static function available(): bool
    {
        $schema = Schema::connection('crms');
        foreach (self::TABLES as $table) {
            if (! $schema->hasTable($table)) {
                return false;
            }
        }

        return $schema->hasColumn('client_contact', 'portal_user_id');
    }
}
