<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * The CRMS research distribution hierarchy as the Email desk sees it:
 * Research-Domestics and Research-Foreign, each sector with its tickers and
 * the client contacts tagged into it. A contact is *reachable* only through
 * its linked portal account (client_contact.portal_user_id → an approved,
 * unsuspended CMS user), which is the same bridge SectorGroupMatcher walks,
 * so what the desk shows is exactly what a blast could send to. Read-only
 * over the `crms` connection and inert when that database is not there.
 */
class ResearchAudience
{
    private const TABLES = ['sector_group', 'sector_group_corporate', 'client_contact_sector_group', 'client_contact', 'corporate'];

    /**
     * Every sector in position order, per scope, with its recipients resolved.
     *
     * @return array<int, array{id: string, scope: string, name: string, position: int, tickers: array<int, string>, contactCount: int, unlinkedCount: int, recipients: array<int, array{email: string, name: string|null, userId: string, source: string}>}>
     */
    public static function groups(): array
    {
        try {
            if (! self::available()) {
                return [];
            }

            $db = DB::connection('crms');

            $groups = $db->table('sector_group')->orderBy('scope')->orderBy('position')->orderBy('id')->get();
            if ($groups->isEmpty()) {
                return [];
            }

            $tickers = $db->table('sector_group_corporate as x')
                ->join('corporate as c', 'c.id', '=', 'x.corporate_id')
                ->orderBy('c.id')
                ->get(['x.sector_group_id', 'c.ticker', 'c.name'])
                ->groupBy('sector_group_id');

            $members = $db->table('client_contact_sector_group as m')
                ->join('client_contact as cc', 'cc.id', '=', 'm.client_contact_id')
                ->get(['m.sector_group_id', 'cc.id', 'cc.portal_user_id'])
                ->groupBy('sector_group_id');

            // One CMS lookup for every linked portal account across all groups.
            $portalIds = $members->flatten(1)->pluck('portal_user_id')->filter()->map(fn ($id) => (int) $id)->unique()->values();
            $users = $portalIds->isEmpty() ? collect() : User::whereIn('id', $portalIds)
                ->where('kind', User::KIND_CLIENT)
                ->where('status', User::STATUS_APPROVED)
                ->where('suspended', false)
                ->get(['id', 'name', 'email'])
                ->keyBy('id');

            return $groups->map(function ($g) use ($tickers, $members, $users) {
                $rows = $members->get($g->id, collect());
                $recipients = [];
                $seen = [];
                $unlinked = 0;
                foreach ($rows as $row) {
                    $user = $row->portal_user_id ? $users->get((int) $row->portal_user_id) : null;
                    if (! $user) {
                        $unlinked++;
                        continue;
                    }
                    $email = mb_strtolower(trim((string) $user->email));
                    if ($email === '' || isset($seen[$email])) {
                        continue;
                    }
                    $seen[$email] = true;
                    $recipients[] = ['email' => $email, 'name' => $user->name, 'userId' => (string) $user->id, 'source' => 'client'];
                }

                return [
                    'id' => (string) $g->id,
                    'scope' => $g->scope,
                    'name' => $g->name,
                    'position' => (int) $g->position,
                    'tickers' => $tickers->get($g->id, collect())
                        ->map(fn ($t) => ResearchDistribution::normalise($t->ticker) ?: (string) $t->name)
                        ->values()->all(),
                    'contactCount' => $rows->count(),
                    'unlinkedCount' => $unlinked,
                    'recipients' => $recipients,
                ];
            })->values()->all();
        } catch (Throwable) {
            // An unreachable or half-migrated CRMS database must never break the desk.
            return [];
        }
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
