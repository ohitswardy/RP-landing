<?php

namespace App\Support;

use App\Models\ClientActivity;

/**
 * The Trending Content ranking, computed straight off the consumption
 * ledger. One query serves both the portal dashboard and the CMS rules
 * preview, so what the desk previews is exactly what clients get.
 */
class Trending
{
    public const METRICS = ['views', 'downloads', 'engagement'];

    /**
     * @param  array{metric: string, windowMonths: int, limit: int, minEvents: int}  $rules
     * @return list<array{reportId: string, count: int}>
     */
    public static function rank(array $rules): array
    {
        $events = match ($rules['metric']) {
            'downloads' => ['download'],
            'engagement' => ['view', 'download'],
            default => ['view'],
        };

        $query = ClientActivity::query()
            ->whereIn('event', $events)
            ->whereNotNull('report_id')
            ->selectRaw('report_id, COUNT(*) as tally, MAX(occurred_at) as last_read')
            ->groupBy('report_id')
            ->orderByDesc('tally')
            ->orderByDesc('last_read') // ties go to the most recently read
            ->limit($rules['limit']);

        if ($rules['windowMonths'] > 0) {
            $query->where('occurred_at', '>=', now()->subMonths($rules['windowMonths']));
        }
        if ($rules['minEvents'] > 1) {
            $query->having('tally', '>=', $rules['minEvents']);
        }

        return $query->get()
            ->map(fn (ClientActivity $row) => [
                'reportId' => (string) $row->report_id,
                'count' => (int) $row->tally,
            ])
            ->all();
    }
}
