<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailBlast;
use App\Models\DistributionList;
use App\Models\EmailBlast;
use App\Models\EmailDelivery;
use App\Models\Report;
use App\Models\Subscriber;
use App\Models\User;
use App\Services\MicrosoftGraphMailer;
use App\Support\Audit;
use App\Support\BlastRenderer;
use App\Support\Html;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * The Email desk. Blasts are drafted and previewed here, then sent one of
 * two ways: through Microsoft Graph from the staff member's own mailbox
 * (send — a queued job, batched under Exchange's recipient cap, logged per
 * batch), or by hand through Outlook with the record marked sent afterwards
 * (markSent — the fallback while Graph consent is pending).
 */
class EmailBlastController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'items' => EmailBlast::with('sender')->withBatchCounts()->orderByDesc('id')->get()->map->toWire()->values(),
            'months' => $this->months(),
        ]);
    }

    /**
     * The recipient pool — approved clients (with their preferences), verified
     * subscribers, saved distribution lists — plus what the desk needs to know
     * about the outbound channel before it offers "Send now".
     */
    public function audience(Request $request, MicrosoftGraphMailer $mailer): JsonResponse
    {
        $actor = $request->user();
        $sender = $actor->outlook_email;

        return response()->json([
            'clients' => User::where('kind', User::KIND_CLIENT)
                ->where('status', User::STATUS_APPROVED)
                ->where('suspended', false)
                ->orderBy('name')
                ->get()
                ->map(fn (User $u) => $this->clientWire($u))
                ->values(),
            'subscribers' => Subscriber::where('verified', true)
                ->orderBy('email')
                ->get()
                ->map(fn (Subscriber $s) => [
                    'id' => (string) $s->id,
                    'email' => $s->email,
                    'firm' => $s->firm,
                ])
                ->values(),
            'lists' => DistributionList::with('creator')->orderBy('name')->get()->map->toWire()->values(),
            'dispatch' => [
                'graphReady' => $mailer->enabled(),
                'sender' => $sender,
                'senderAllowed' => $sender ? $mailer->senderAllowed($sender) : false,
                'senderDomain' => (string) config('services.graph.sender_domain'),
                'batchSize' => $mailer->batchSize(),
                'attachmentMaxBytes' => $mailer->attachmentMaxBytes(),
            ],
        ]);
    }

    /**
     * Preview-before-send automation: the Local clients whose preferences
     * match a report, by sector or by analyst byline. Staff prune the list
     * in the composer before anything goes out.
     */
    public function match(Request $request): JsonResponse
    {
        $data = $request->validate([
            'report' => ['required', 'integer', 'exists:reports,id'],
        ]);

        $report = Report::findOrFail($data['report']);
        $category = mb_strtolower(trim((string) $report->category));
        $analyst = mb_strtolower(trim((string) $report->analyst));

        $matches = User::where('kind', User::KIND_CLIENT)
            ->where('status', User::STATUS_APPROVED)
            ->where('suspended', false)
            ->where('client_type', 'Local')
            ->get()
            ->filter(function (User $u) use ($category, $analyst) {
                $sectors = array_map(fn ($s) => mb_strtolower(trim((string) $s)), $u->sector_prefs ?? []);
                $analysts = array_map(fn ($a) => mb_strtolower(trim((string) $a)), $u->preferred_analysts ?? []);

                return ($category !== '' && in_array($category, $sectors, true))
                    || ($analyst !== '' && in_array($analyst, $analysts, true));
            })
            ->map(fn (User $u) => $this->clientWire($u))
            ->values();

        return response()->json(['clients' => $matches]);
    }

    /**
     * The exact HTML a recipient would get, for the composer's live preview.
     * Takes the unsaved fields so the preview never lags the editor, and the
     * same renderer the job uses, so the preview is never a different thing.
     */
    public function render(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:newsletter,report,adhoc'],
            'subject' => ['present', 'nullable', 'string', 'max:300'],
            'htmlBody' => ['present', 'nullable', 'string', 'max:2000000'],
            'reportId' => ['sometimes', 'nullable', 'integer'],
            'externalLink' => ['sometimes', 'nullable', 'string', 'max:500'],
            'variant' => ['sometimes', 'in:local,foreign'],
        ]);

        $report = $data['kind'] === 'report' && ! empty($data['reportId'])
            ? Report::with('company')->find($data['reportId'])
            : null;

        $fields = BlastRenderer::fields(
            kind: $data['kind'],
            subject: (string) ($data['subject'] ?? ''),
            htmlBody: $data['htmlBody'] ?? null,
            report: $report,
            externalLink: $data['externalLink'] ?? null,
        );

        return response()->json(['html' => BlastRenderer::render($fields, $data['variant'] ?? 'local')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, required: true);

        $blast = EmailBlast::create($data);
        $audit = Audit::log('Drafted email blast', $blast->subject);

        return response()->json(['item' => $this->wire($blast), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, EmailBlast $blast): JsonResponse
    {
        if ($blast->isLocked()) {
            return response()->json(['message' => $this->lockedMessage($blast)], 422);
        }

        $data = $this->validated($request, required: false);

        $blast->fill($data)->save();
        $audit = Audit::log('Updated email blast', $blast->subject);

        return response()->json(['item' => $this->wire($blast), 'audit' => $audit->toWire()]);
    }

    /**
     * Send through Graph from the signed-in staff member's mailbox. Plans the
     * batches, freezes the record, and hands off to the queue; a failed blast
     * comes back here to retry only the batches that did not go out. The
     * status flip happens under a row lock so a double-click cannot queue
     * the same blast twice.
     */
    public function send(Request $request, EmailBlast $blast, MicrosoftGraphMailer $mailer): JsonResponse
    {
        $actor = $request->user();

        if (! $mailer->enabled()) {
            return response()->json(['message' => 'Server-side sending is not configured yet. Use the Outlook hand-off.'], 422);
        }
        if (! $actor->outlook_email) {
            return response()->json(['message' => 'Your staff profile has no Outlook account to send from. An administrator can add one under Users & access.'], 422);
        }
        if (! $mailer->senderAllowed($actor->outlook_email)) {
            return response()->json(['message' => 'Blasts can only leave from a '.config('services.graph.sender_domain').' mailbox.'], 422);
        }
        if ($blast->isInFlight()) {
            return response()->json(['message' => 'This blast is already on its way.'], 409);
        }
        if ($blast->status === 'sent') {
            return response()->json(['message' => 'This blast has gone out. Duplicate it to send a revised version.'], 422);
        }

        $retry = $blast->status === 'failed';
        if (! $retry && ($problem = $this->readinessProblem($blast, $mailer)) !== null) {
            return response()->json(['message' => $problem], 422);
        }

        $queued = DB::transaction(function () use ($blast, $actor, $mailer, $retry) {
            $fresh = EmailBlast::whereKey($blast->id)->lockForUpdate()->first();
            if (! $fresh || $fresh->isInFlight() || $fresh->status === 'sent') {
                return null;
            }

            if ($retry) {
                $reset = $fresh->deliveries()->where('status', 'failed')->update(['status' => 'pending', 'error' => null]);
                if ($reset === 0) {
                    return false;
                }
            } else {
                $fresh->deliveries()->delete();
                $rows = EmailDelivery::plan($fresh, $mailer->batchSize());
                if ($rows === []) {
                    return false;
                }
                $fresh->deliveries()->createMany($rows);
            }

            $fresh->forceFill([
                'status' => 'queued',
                'queued_at' => now(),
                'sent_by' => $actor->id,
                'sender_outlook' => $actor->outlook_email,
                'channel' => 'graph',
                'send_error' => null,
            ])->save();

            return $fresh;
        });

        if ($queued === null) {
            return response()->json(['message' => 'This blast is already on its way.'], 409);
        }
        if ($queued === false) {
            return response()->json(['message' => $retry ? 'There are no failed batches to retry.' : 'The blast has no deliverable recipients.'], 422);
        }

        SendEmailBlast::dispatch($queued->id);
        $audit = Audit::log($retry ? 'Retried email blast' : 'Queued email blast', $blast->subject);

        return response()->json(['item' => $this->wire($queued), 'audit' => $audit->toWire()]);
    }

    /** The per-batch delivery log behind a Graph-sent blast. */
    public function deliveries(EmailBlast $blast): JsonResponse
    {
        return response()->json([
            'items' => $blast->deliveries()->orderBy('id')->get()->map->toWire()->values(),
        ]);
    }

    /** Sending happened in Outlook; this records that it did, and by whom. */
    public function markSent(Request $request, EmailBlast $blast): JsonResponse
    {
        if ($blast->isLocked()) {
            return response()->json(['message' => $this->lockedMessage($blast)], 422);
        }

        $actor = $request->user();
        $blast->forceFill([
            'status' => 'sent',
            'channel' => 'outlook',
            'sent_at' => now(),
            'sent_by' => $actor->id,
            'sender_outlook' => $actor->outlook_email,
            'sent_count' => $blast->recipientTotal(),
            'failed_count' => 0,
            'send_error' => null,
        ])->save();

        $audit = Audit::log('Sent email blast', $blast->subject);

        return response()->json(['item' => $this->wire($blast), 'audit' => $audit->toWire()]);
    }

    public function destroy(EmailBlast $blast): JsonResponse
    {
        if ($blast->isInFlight()) {
            return response()->json(['message' => 'This blast is being sent. Wait for it to finish.'], 409);
        }

        $subject = $blast->subject;
        $blast->delete();
        $audit = Audit::log('Deleted email blast', $subject);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /* ── Helpers ─────────────────────────────────────────────── */

    private function wire(EmailBlast $blast): array
    {
        return $blast->load('sender')->loadBatchCounts()->toWire();
    }

    private function clientWire(User $u): array
    {
        return [
            'id' => (string) $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'firm' => $u->firm,
            'clientType' => $u->client_type,
            'sectorPrefs' => $u->sector_prefs ?? [],
            'preferredAnalysts' => $u->preferred_analysts ?? [],
        ];
    }

    private function lockedMessage(EmailBlast $blast): string
    {
        return match ($blast->status) {
            'queued', 'sending' => 'This blast is being sent and cannot change now.',
            'failed' => 'This blast partly went out; its content is frozen. Retry the failed batches, or duplicate it.',
            default => 'This blast has gone out. Duplicate it to send a revised version.',
        };
    }

    /** Why a blast cannot go out yet, or null when it can. */
    private function readinessProblem(EmailBlast $blast, MicrosoftGraphMailer $mailer): ?string
    {
        if (trim((string) $blast->html_body) === '') {
            return 'The blast has no body yet.';
        }
        if ($blast->recipientTotal() === 0) {
            return 'The blast has no recipients.';
        }
        if ($blast->kind !== 'report') {
            return null;
        }

        $report = $blast->report;
        if (! $report) {
            return 'The report this blast carries no longer exists.';
        }
        if ($blast->hasForeignVariant() && $blast->recipientsFor('foreign') !== [] && trim((string) $blast->external_link) === '') {
            return 'Foreign recipients need the external (Jefferies) link before this can go out.';
        }
        if ($blast->attach_report) {
            $path = (string) $report->file_path;
            if ($path === '' || ! Storage::exists($path)) {
                return 'The report has no stored PDF to attach.';
            }
            $size = Storage::size($path);
            $max = $mailer->attachmentMaxBytes();
            if ($size > $max) {
                return sprintf(
                    'The report PDF is %.1f MB; attachments are capped at %d MB. Switch the attachment off and send the link.',
                    $size / 1048576,
                    intdiv($max, 1048576),
                );
            }
        }

        return null;
    }

    /** Sent volume by month, last six months, for the ledger's stat rail. */
    private function months(): array
    {
        $start = now()->startOfMonth()->subMonths(5);
        $buckets = [];
        for ($i = 0; $i < 6; $i++) {
            $key = $start->copy()->addMonths($i)->format('Y-m');
            $buckets[$key] = ['month' => $key, 'blasts' => 0, 'recipients' => 0];
        }

        EmailBlast::whereIn('status', ['sent', 'failed'])
            ->where('sent_at', '>=', $start)
            ->get(['sent_at', 'sent_count'])
            ->each(function (EmailBlast $b) use (&$buckets) {
                $key = $b->sent_at?->format('Y-m');
                if ($key !== null && isset($buckets[$key])) {
                    $buckets[$key]['blasts']++;
                    $buckets[$key]['recipients'] += (int) $b->sent_count;
                }
            });

        return array_values($buckets);
    }

    /**
     * The whitelist both writes share. Editor fragments (report and ad-hoc
     * bodies) are sanitized on the way in; newsletter bodies are full
     * documents rendered from the house template, stored as rendered because
     * the sanitizer would strip the inline styles the mailer depends on.
     */
    private function validated(Request $request, bool $required): array
    {
        $when = $required ? 'required' : 'sometimes';
        $recipient = fn (string $key, string $presence) => [
            $key => [$presence, 'nullable', 'array', 'max:2000'],
            "$key.*.email" => ['required', 'email', 'max:190'],
            "$key.*.name" => ['sometimes', 'nullable', 'string', 'max:120'],
            "$key.*.userId" => ['sometimes', 'nullable', 'string', 'max:20'],
            "$key.*.source" => ['required', 'in:client,subscriber,manual'],
        ];

        $data = $request->validate([
            'kind' => [$when, 'in:newsletter,report,adhoc'],
            'subject' => [$when, 'string', 'max:300'],
            'htmlBody' => ['sometimes', 'nullable', 'string', 'max:2000000'],
            'reportId' => ['sometimes', 'nullable', 'integer', 'exists:reports,id'],
            'newsletterIssueId' => ['sometimes', 'nullable', 'integer', 'exists:newsletter_issues,id'],
            'externalLink' => ['sometimes', 'nullable', 'url', 'max:500'],
            'attachReport' => ['sometimes', 'boolean'],
            'status' => ['sometimes', 'in:draft,ready'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            ...$recipient('recipients', $when),
            ...$recipient('recipientsForeign', 'sometimes'),
        ]);

        $out = [];
        foreach (['kind', 'subject', 'status', 'notes'] as $key) {
            if (array_key_exists($key, $data)) {
                $out[$key] = $data[$key];
            }
        }
        if (array_key_exists('htmlBody', $data)) {
            $html = $data['htmlBody'];
            if ($html !== null && ! BlastRenderer::isDocument($html)) {
                $html = Html::clean($html);
                $html = $html === '' ? null : $html;
            }
            $out['html_body'] = $html;
        }
        if (array_key_exists('reportId', $data)) {
            $out['report_id'] = $data['reportId'];
        }
        if (array_key_exists('newsletterIssueId', $data)) {
            $out['newsletter_issue_id'] = $data['newsletterIssueId'];
        }
        if (array_key_exists('externalLink', $data)) {
            $out['external_link'] = $data['externalLink'];
        }
        if (array_key_exists('attachReport', $data)) {
            $out['attach_report'] = (bool) $data['attachReport'];
        }
        if (array_key_exists('recipients', $data)) {
            $out['recipients'] = $this->cleanRecipients($data['recipients'] ?? []);
        }
        if (array_key_exists('recipientsForeign', $data)) {
            $out['recipients_foreign'] = $data['recipientsForeign'] === null
                ? null
                : $this->cleanRecipients($data['recipientsForeign']);
        }

        return $out;
    }

    /** Rebuilt key-by-key so nothing beyond the whitelist lands in the JSON column. */
    private function cleanRecipients(array $list): array
    {
        return array_values(array_map(fn (array $r) => [
            'email' => mb_strtolower($r['email']),
            'name' => $r['name'] ?? null,
            'userId' => $r['userId'] ?? null,
            'source' => $r['source'],
        ], $list));
    }
}
