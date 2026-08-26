<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientActivity;
use App\Models\Report;
use App\Models\User;
use App\Support\ClientLog;
use App\Support\SimpleXlsx;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ClientLogController extends Controller
{
    private const PER_PAGE_MAX = 100;

    /** Columns the ledger can sort on, keyed by their wire names. */
    private const SORTS = [
        'at' => 'occurred_at',
        'actor' => 'actor_name',
        'event' => 'event',
        'target' => 'target',
    ];

    /* ── Portal: record one event ─────────────────────────────── */

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'in:'.implode(',', ClientActivity::EVENTS)],
            'reportId' => ['nullable', 'integer', 'exists:reports,id'],
            'context' => ['nullable', 'string', 'max:40'],
        ]);

        $report = isset($data['reportId']) ? Report::find($data['reportId']) : null;
        ClientLog::record($request, $data['event'], $report, $data['context'] ?? '');

        return response()->json(['ok' => true], 201);
    }

    /* ── CMS: the ledger ──────────────────────────────────────── */

    public function index(Request $request): JsonResponse
    {
        $filtered = $this->filtered($request);

        $sort = self::SORTS[$request->query('sort', 'at')] ?? 'occurred_at';
        $dir = $request->query('dir') === 'asc' ? 'asc' : 'desc';
        $perPage = min(max((int) $request->query('perPage', 25), 1), self::PER_PAGE_MAX);

        $page = $filtered->clone()
            ->orderBy($sort, $dir)
            ->orderBy('id', $dir)
            ->paginate($perPage, ['*'], 'page', max((int) $request->query('page', 1), 1));

        // One aggregate pass over the filtered set (minus the event filter,
        // so the per-event figures always show the full split).
        $summary = $this->filtered($request, withEvent: false)
            ->selectRaw("count(*) as total")
            ->selectRaw("sum(event = 'view') as views")
            ->selectRaw("sum(event = 'download') as downloads")
            ->selectRaw("sum(event = 'click') as clicks")
            ->selectRaw('count(distinct user_id) as actors')
            ->first();

        return response()->json([
            'items' => collect($page->items())->map->toWire()->values(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'pages' => max($page->lastPage(), 1),
            'perPage' => $perPage,
            'summary' => [
                'total' => (int) $summary->total,
                'views' => (int) $summary->views,
                'downloads' => (int) $summary->downloads,
                'clicks' => (int) $summary->clicks,
                'actors' => (int) $summary->actors,
            ],
            'clients' => User::where('kind', User::KIND_CLIENT)
                ->orderBy('name')
                ->get(['id', 'name', 'firm'])
                ->map(fn (User $u) => ['id' => (string) $u->id, 'name' => $u->name, 'firm' => $u->firm])
                ->values(),
        ]);
    }

    /** Stream the filtered ledger as CSV or a real XLSX workbook. */
    public function export(Request $request): Response
    {
        $query = $this->filtered($request)->orderByDesc('occurred_at')->orderByDesc('id');
        $stamp = now()->format('Ymd-His');

        $headers = ['Timestamp', 'Client', 'Email', 'Firm', 'Event', 'Report', 'Context', 'IP address', 'Entry hash'];
        $toRow = fn (ClientActivity $a) => [
            $a->occurred_at->format('Y-m-d H:i:s'),
            $a->actor_name,
            $a->actor_email,
            $a->actor_firm ?? '',
            $a->event,
            $a->target,
            $a->context,
            $a->ip ?? '',
            $a->hash,
        ];

        if ($request->query('format') === 'xlsx') {
            return SimpleXlsx::download(
                "client-logs-{$stamp}.xlsx",
                $headers,
                $query->lazy()->map($toRow),
            );
        }

        return response()->streamDownload(function () use ($query, $headers, $toRow) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\u{FEFF}"); // BOM so Excel reads the UTF-8 correctly
            fputcsv($out, $headers);
            foreach ($query->lazy() as $activity) {
                fputcsv($out, $toRow($activity));
            }
            fclose($out);
        }, "client-logs-{$stamp}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Recompute the whole hash chain and report the first break, if any. */
    public function verify(): JsonResponse
    {
        return response()->json(ClientLog::verify());
    }

    /* ── Shared filter builder ────────────────────────────────── */

    private function filtered(Request $request, bool $withEvent = true): Builder
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = ClientActivity::query();

        if ($withEvent && in_array($event = $request->query('event'), ClientActivity::EVENTS, true)) {
            $query->where('event', $event);
        }
        if (($clientId = (int) $request->query('clientId')) > 0) {
            $query->where('user_id', $clientId);
        }
        if ($from = $request->date('from')) {
            $query->where('occurred_at', '>=', $from->startOfDay());
        }
        if ($to = $request->date('to')) {
            $query->where('occurred_at', '<=', $to->endOfDay());
        }
        if ($q = trim((string) $request->query('q'))) {
            $query->where(function (Builder $w) use ($q) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
                $w->where('actor_name', 'like', $like)
                    ->orWhere('actor_email', 'like', $like)
                    ->orWhere('actor_firm', 'like', $like)
                    ->orWhere('target', 'like', $like);
            });
        }

        return $query;
    }
}
