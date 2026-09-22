<?php

namespace App\Http\Controllers\Crms;

use App\Models\AuditEntry;
use App\Models\Crms\Event;
use App\Models\Crms\EventAttendee;
use App\Models\Crms\Interaction;
use App\Models\Crms\OneOffMeeting;
use App\Models\Crms\SellsideContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * My Activity (CRMSmasterplan.md §4.1 "My Profile / My Activity"): the
 * signed-in staff member's own footprint in the CRMS for a date range.
 *
 * Attribution comes from three places, because the legacy schema never
 * had one author column:
 *  - interactions.user_id and event.user_id point at the legacy `user`
 *    table, matched to the CMS account by email (CrmsController::legacyUserId);
 *  - the Regis party on a roadshow is the `bank` table (EventAttendee), a
 *    sellside_contact id, plus the header's sellside_contact snapshot list,
 *    both matched to the staff member by their directory email;
 *  - everything else (events created, edits, deletes, reports) is the CMS
 *    audit ledger, which records the CMS user id on every CRMS write.
 * Read-only; nothing here writes.
 */
class MyActivityController extends CrmsController
{
    private const PER_PAGE_MAX = 100;

    /** Rows pulled per source before the merge; a single desk never nears this in one range. */
    private const SOURCE_CAP = 1000;

    /** The ledger actions that mean a roadshow was created (roadshow has no author column). */
    private const EVENT_CREATED_ACTIONS = ['CRMS · Created Company Roadshow', 'CRMS · Created Reverse Roadshow', 'CRMS · Created Analyst Marketing'];

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $to = $request->query('to') ?: now()->format('Y-m-d');
        $from = $request->query('from') ?: now()->subMonths(11)->startOfMonth()->format('Y-m-d');
        $fromAt = $from.' 00:00:00';
        $toAt = $to.' 23:59:59';
        $email = mb_strtolower(trim((string) $user->email));

        $legacyId = $this->legacyUserId();
        $legacy = $legacyId ? DB::connection('crms')->table('user')->where('id', $legacyId)->first() : null;

        /* ── Sources ─────────────────────────────────────────── */

        $interactions = $legacyId
            ? Interaction::with(['client', 'type'])->where('user_id', $legacyId)->between($from, $to)
                ->orderByDesc('interaction_date')->orderByDesc('id')->limit(self::SOURCE_CAP)->get()
            : collect();

        $meetings = $legacyId
            ? OneOffMeeting::with(['client', 'corporate'])->where('user_id', $legacyId)->whereBetween('start_date', [$fromAt, $toAt])
                ->orderByDesc('start_date')->orderByDesc('id')->limit(self::SOURCE_CAP)->get()
            : collect();

        $events = $this->attendedEvents($email, $fromAt, $toAt);

        $audit = AuditEntry::where('user_id', $user->id)->where('action', 'like', 'CRMS · %')
            ->whereBetween('at', [$fromAt, $toAt])
            ->orderByDesc('at')->orderByDesc('id')->limit(self::SOURCE_CAP)->get();

        /* ── Feed: one merged, date-sorted list, paged in memory ── */

        $feed = [];
        foreach ($interactions as $i) {
            $feed[] = $this->row('interaction', $i->id, $i->interaction_date?->toIso8601String(), $i->client?->name ?? 'Unknown client',
                implode(' · ', array_filter([$i->reference(), $i->type?->type, $i->meeting_type])), '/crms/interactions/'.$i->id, [
                    'minutes' => $i->minutes(),
                    'important' => (bool) $i->important,
                    'disposition' => $i->disposition ?: Interaction::DISPOSITION_CLOSED,
                ]);
        }
        foreach ($meetings as $m) {
            $feed[] = $this->row('meeting', $m->id, $m->start_date?->toIso8601String(), $m->subject(),
                implode(' · ', array_filter(['One-Off Meeting', $m->classification, $m->location])), '/crms/events/meetings/'.$m->id);
        }
        foreach ($events as $e) {
            $cat = $e->category();
            $count = (int) ($e->meetings_count ?? 0);
            $feed[] = $this->row('event', $e->id, $e->start_date?->toIso8601String(), $e->subject(),
                implode(' · ', array_filter([$cat?->label() ?? 'Event', $e->classification, $count.' meeting'.($count === 1 ? '' : 's')])),
                '/crms/events/'.($cat?->slug() ?? 'roadshows').'/'.$e->id);
        }
        foreach ($audit as $a) {
            $feed[] = $this->row('audit', $a->id, $a->at->toIso8601String(), preg_replace('/^CRMS · /u', '', $a->action), $a->target, null);
        }
        usort($feed, fn ($a, $b) => strcmp((string) $b['at'], (string) $a['at']) ?: strcmp($b['key'], $a['key']));

        $perPage = min(max($request->integer('perPage', 25), 1), self::PER_PAGE_MAX);
        $total = count($feed);
        $pages = max((int) ceil($total / $perPage), 1);
        $page = min(max($request->integer('page', 1), 1), $pages);

        /* ── Tiles ───────────────────────────────────────────── */

        $eventsCreated = AuditEntry::where('user_id', $user->id)->whereIn('action', self::EVENT_CREATED_ACTIONS)->whereBetween('at', [$fromAt, $toAt])->count();
        // event.user_id carries the author when the legacy row matched; otherwise the ledger is the only record.
        $meetingsCreated = $legacyId
            ? $meetings->count()
            : AuditEntry::where('user_id', $user->id)->where('action', 'CRMS · Created one-off meeting')->whereBetween('at', [$fromAt, $toAt])->count();

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->name,
                'outlookEmail' => $user->outlook_email,
                'legacyUser' => [
                    'matched' => $legacyId !== null,
                    'id' => $legacyId !== null ? (string) $legacyId : null,
                    'name' => $legacy ? (trim(($legacy->first_name ?? '').' '.($legacy->last_name ?? '')) ?: null) : null,
                    'type' => $legacy->type ?? null,
                    'email' => $legacy->email ?? null,
                ],
            ],
            'totals' => [
                'interactions' => $interactions->count(),
                'minutes' => (int) $interactions->sum(fn (Interaction $i) => $i->minutes()),
                'important' => $interactions->where('important', true)->count(),
                'meetingsCreated' => $meetingsCreated,
                'eventsCreated' => $eventsCreated,
                'eventsAttended' => $events->count(),
                'actions' => $audit->count(),
            ],
            'feed' => [
                'items' => array_slice($feed, ($page - 1) * $perPage, $perPage),
                'total' => $total,
                'page' => $page,
                'pages' => $pages,
            ],
        ]);
    }

    private function row(string $kind, int|string $id, ?string $at, string $title, ?string $subtitle, ?string $href, array $extra = []): array
    {
        return array_merge([
            'key' => $kind.':'.$id,
            'kind' => $kind,
            'at' => $at,
            'title' => $title,
            'subtitle' => $subtitle ?: null,
            'href' => $href,
            'minutes' => null,
            'important' => false,
            'disposition' => null,
        ], $extra);
    }

    /**
     * Roadshows this staff member is on: a `bank` row for a directory entry
     * with their email, or a header sellside_contact snapshot with that
     * email or one of those directory ids.
     */
    private function attendedEvents(string $email, string $fromAt, string $toAt): Collection
    {
        if ($email === '') {
            return collect();
        }
        $directoryIds = SellsideContact::whereRaw('LOWER(email) = ?', [$email])->pluck('id')->map(fn ($id) => (int) $id)->all();
        $eventIds = $directoryIds
            ? EventAttendee::whereIn('sellside_contact_id', $directoryIds)->pluck('roadshow_id')->map(fn ($id) => (int) $id)->unique()->values()->all()
            : [];

        $rows = Event::with(['corporate', 'client'])->withCount('meetings')
            ->whereBetween('start_date', [$fromAt, $toAt])
            ->where(function ($w) use ($eventIds, $directoryIds, $email) {
                $w->whereRaw('LOWER(sellside_contact) LIKE ?', ['%"email":'.json_encode($email).'%']);
                if ($eventIds) {
                    $w->orWhereIn('id', $eventIds);
                }
                foreach ($directoryIds as $id) {
                    $w->orWhere('sellside_contact', 'like', '%"id":'.$id.',%');
                }
            })
            ->orderByDesc('start_date')->orderByDesc('id')->limit(self::SOURCE_CAP)->get();

        // The LIKE on ids is a prefilter; confirm on the decoded snapshot so "id":12, never matches 120.
        return $rows->filter(fn (Event $e) => in_array((int) $e->id, $eventIds, true)
            || collect($e->sellside_contact)->contains(fn ($s) => is_array($s) && (
                mb_strtolower((string) ($s['email'] ?? '')) === $email || in_array((int) ($s['id'] ?? 0), $directoryIds, true)
            )))->values();
    }
}
