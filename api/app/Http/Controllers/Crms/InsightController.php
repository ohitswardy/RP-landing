<?php

namespace App\Http\Controllers\Crms;

use App\Enums\Crms\EventCategory;
use App\Models\AuditEntry;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Event;
use App\Models\Crms\Interaction;
use App\Models\Crms\Meeting;
use App\Models\Crms\OneOffMeeting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only aggregations: the dashboard summary, the calendar feed, ticker
 * search, and the CRMS slice of the audit ledger. Nothing here writes.
 */
class InsightController extends CrmsController
{
    /* ── Dashboard (§7.7) ─────────────────────────────────────── */

    /** How many important interactions the dashboard shelf shows. */
    private const IMPORTANT_SHELF = 8;

    public function summary(Request $request): JsonResponse
    {
        $to = $request->query('to') ?: now()->format('Y-m-d');
        $from = $request->query('from') ?: now()->subMonths(11)->startOfMonth()->format('Y-m-d');

        $interactions = Interaction::with('client')->between($from, $to)->get();

        $byMonth = [];
        $byClient = [];
        $stocks = [];
        foreach ($interactions as $i) {
            $month = substr((string) $i->interaction_date, 0, 7);
            $byMonth[$month] ??= ['month' => $month, 'minutes' => 0, 'count' => 0];
            $byMonth[$month]['minutes'] += $i->minutes();
            $byMonth[$month]['count']++;

            $client = $i->client?->name ?? 'Unknown client';
            $byClient[$client] ??= ['client' => $client, 'clientId' => (string) $i->client_id, 'minutes' => 0, 'count' => 0];
            $byClient[$client]['minutes'] += $i->minutes();
            $byClient[$client]['count']++;

            foreach ($i->corporatesDiscussed() as $c) {
                $key = $c['ticker'] ?: $c['name'];
                if ($key) {
                    $stocks[$key] = ($stocks[$key] ?? 0) + 1;
                }
            }
        }
        ksort($byMonth);
        usort($byClient, fn ($a, $b) => $b['minutes'] <=> $a['minutes']);
        arsort($stocks);

        // Reverse-roadshow demand: which corporates were requested, and by whom.
        $events = Event::with('client')->where('category', EventCategory::ReverseRoadshow->value)
            ->whereBetween('start_date', [$from.' 00:00:00', $to.' 23:59:59'])->get()->keyBy('id');
        $demand = [];
        if ($events->isNotEmpty()) {
            $meetings = Meeting::with('corporate')->whereIn('roadshow_id', $events->keys())->whereNotNull('corporate_id')->get();
            foreach ($meetings as $m) {
                $name = $m->corporate?->name ?? "Corporate #{$m->corporate_id}";
                $demand[$name] ??= ['corporate' => $name, 'ticker' => $m->corporate?->ticker, 'requests' => 0, 'clients' => []];
                $demand[$name]['requests']++;
                $client = $events[$m->roadshow_id]?->client?->name;
                if ($client && ! in_array($client, $demand[$name]['clients'], true)) {
                    $demand[$name]['clients'][] = $client;
                }
            }
            usort($demand, fn ($a, $b) => $b['requests'] <=> $a['requests']);
        }

        // The legacy dashboard tallies: company roadshows per corporate, reverse roadshows per client.
        $tally = fn (EventCategory $cat, string $relation, string $key) => Event::with($relation)
            ->where('category', $cat->value)->whereBetween('start_date', [$from.' 00:00:00', $to.' 23:59:59'])->get()
            ->groupBy(fn (Event $e) => $e->{$relation}?->name ?? 'Unknown')
            ->map(fn ($group, $name) => [$key => $name, 'events' => $group->count(), 'meetings' => (int) Meeting::whereIn('roadshow_id', $group->pluck('id'))->count()])
            ->sortByDesc('events')->values()->take(10)->all();
        $roadshowTally = $tally(EventCategory::Roadshow, 'corporate', 'corporate');
        $reverseTally = $tally(EventCategory::ReverseRoadshow, 'client', 'client');

        // Important interactions are a pinned shelf, not a range statistic: the
        // latest few regardless of the dates picked, so nothing marked goes unseen.
        $important = Interaction::with(['client', 'type'])->important()
            ->orderByDesc('interaction_date')->orderByDesc('id')->limit(self::IMPORTANT_SHELF)->get();

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'totals' => [
                'interactions' => $interactions->count(),
                'minutes' => (int) $interactions->sum(fn ($i) => $i->minutes()),
                'clients' => $interactions->pluck('client_id')->unique()->count(),
                'important' => Interaction::important()->count(),
                'openFlags' => Interaction::where('disposition', Interaction::DISPOSITION_FLAGGED)->whereNull('actioned_at')->count(),
                'upcomingEvents' => Event::where('start_date', '>=', now()->startOfDay())->count()
                    + OneOffMeeting::where('start_date', '>=', now()->startOfDay())->count(),
                'events' => Event::whereBetween('start_date', [$from.' 00:00:00', $to.' 23:59:59'])->count()
                    + OneOffMeeting::whereBetween('start_date', [$from.' 00:00:00', $to.' 23:59:59'])->count(),
            ],
            'roadshowTally' => $roadshowTally,
            'reverseTally' => $reverseTally,
            'important' => $important->map->toWire()->values(),
            'byMonth' => array_values($byMonth),
            'byClient' => array_slice($byClient, 0, 10),
            'topStocks' => array_slice(array_map(fn ($k, $v) => ['stock' => $k, 'mentions' => $v], array_keys($stocks), $stocks), 0, 10),
            'reverseDemand' => array_slice(array_values($demand), 0, 10),
        ]);
    }

    /* ── Calendar (§7.5) ──────────────────────────────────────── */

    public function calendar(Request $request): JsonResponse
    {
        $from = $request->query('from') ?: now()->startOfMonth()->format('Y-m-d');
        $to = $request->query('to') ?: now()->endOfMonth()->format('Y-m-d');

        $events = Event::with(['corporate', 'client'])
            ->where('start_date', '<=', $to.' 23:59:59')
            ->where(fn ($q) => $q->where('end_date', '>=', $from.' 00:00:00')->orWhere(fn ($w) => $w->whereNull('end_date')->where('start_date', '>=', $from.' 00:00:00')))
            ->get();

        $meetings = Meeting::with(['client', 'corporate'])->whereBetween('date', [$from.' 00:00:00', $to.' 23:59:59'])->get();
        $oneOff = OneOffMeeting::with(['client', 'corporate'])->whereBetween('start_date', [$from.' 00:00:00', $to.' 23:59:59'])->get();

        return response()->json([
            'events' => $events->map->toWire()->values(),
            'meetings' => $meetings->map->toWire()->values(),
            'oneOffMeetings' => $oneOff->map->toWire()->values(),
        ]);
    }

    /* ── Ticker search (§7.4) ─────────────────────────────────── */

    public function holders(Corporate $corporate): JsonResponse
    {
        $needle = '"id":'.$corporate->id.',';
        $contacts = ClientContact::with('client')
            ->where(fn ($q) => $q->where('own', 'like', "%$needle%")->orWhere('watchlist', 'like', "%$needle%"))
            ->get();

        $has = fn (array $list) => collect($list)->contains(fn ($c) => (int) ($c['id'] ?? 0) === (int) $corporate->id);
        $owners = $contacts->filter(fn ($c) => $has($c->own))->map->toWire()->values();
        $watchers = $contacts->filter(fn ($c) => $has($c->watchlist))->map->toWire()->values();

        return response()->json([
            'corporate' => $corporate->toWire(),
            'owners' => $owners,
            'watchers' => $watchers,
            // Lookup snapshots carry the corporate id; the stock fields may hold a bare ticker.
            'lastDiscussed' => Interaction::with('client')
                ->where(fn ($q) => $q->where('form', 'like', '%"id":'.(int) $corporate->id.',%')
                    ->when($corporate->ticker, fn ($w) => $w->orWhere('form', 'like', '%"value":'.json_encode((string) $corporate->ticker).'%')))
                ->orderByDesc('interaction_date')->limit(200)->get()
                ->filter(fn (Interaction $i) => collect($i->corporatesDiscussed())->contains(fn ($c) => $c['id'] === (int) $corporate->id || ($corporate->ticker && strcasecmp((string) $c['ticker'], (string) $corporate->ticker) === 0)))
                ->take(10)->map->toWire()->values(),
        ]);
    }

    /* ── Logs ─────────────────────────────────────────────────── */

    public function logs(Request $request): JsonResponse
    {
        $q = AuditEntry::where('action', 'like', 'CRMS · %');
        if ($year = $request->integer('year')) {
            $q->whereYear('at', $year);
        }
        if ($month = $request->integer('month')) {
            $q->whereMonth('at', $month);
        }
        if ($term = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('actor', 'like', "%$term%")->orWhere('action', 'like', "%$term%")->orWhere('target', 'like', "%$term%"));
        }
        $page = $q->orderByDesc('at')->orderByDesc('id')->paginate(min(max($request->integer('perPage', 50), 1), 200), ['*'], 'page', max($request->integer('page', 1), 1));

        return response()->json([
            'items' => collect($page->items())->map->toWire()->values(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'pages' => max($page->lastPage(), 1),
        ]);
    }
}
