<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailBlast;
use App\Models\Report;
use App\Models\Subscriber;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Email desk. Blasts are drafted and edited here; nothing is dispatched
 * from the server — staff copy the composed HTML into Outlook and then mark
 * the blast sent, which snapshots who sent it and from which Outlook account.
 */
class EmailBlastController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'items' => EmailBlast::with('sender')->orderByDesc('id')->get()->map->toWire()->values(),
        ]);
    }

    /** The recipient pool: approved clients (with their preferences) and verified subscribers. */
    public function audience(): JsonResponse
    {
        return response()->json([
            'clients' => User::where('kind', User::KIND_CLIENT)
                ->where('status', User::STATUS_APPROVED)
                ->where('suspended', false)
                ->orderBy('name')
                ->get()
                ->map(fn (User $u) => [
                    'id' => (string) $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'firm' => $u->firm,
                    'clientType' => $u->client_type,
                    'sectorPrefs' => $u->sector_prefs ?? [],
                    'preferredAnalysts' => $u->preferred_analysts ?? [],
                ])
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
            ->map(fn (User $u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'firm' => $u->firm,
                'clientType' => $u->client_type,
                'sectorPrefs' => $u->sector_prefs ?? [],
                'preferredAnalysts' => $u->preferred_analysts ?? [],
            ])
            ->values();

        return response()->json(['clients' => $matches]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, required: true);

        $blast = EmailBlast::create($data);
        $audit = Audit::log('Drafted email blast', $blast->subject);

        return response()->json(['item' => $blast->load('sender')->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, EmailBlast $blast): JsonResponse
    {
        if ($blast->status === 'sent') {
            return response()->json(['message' => 'This blast has gone out. Duplicate it to send a revised version.'], 422);
        }

        $data = $this->validated($request, required: false);

        $blast->fill($data)->save();
        $audit = Audit::log('Updated email blast', $blast->subject);

        return response()->json(['item' => $blast->load('sender')->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Sending happens in Outlook; this records that it did, and by whom. */
    public function markSent(Request $request, EmailBlast $blast): JsonResponse
    {
        if ($blast->status === 'sent') {
            return response()->json(['message' => 'This blast is already marked sent.'], 422);
        }

        $actor = $request->user();
        $blast->forceFill([
            'status' => 'sent',
            'sent_at' => now(),
            'sent_by' => $actor->id,
            'sender_outlook' => $actor->outlook_email,
        ])->save();

        $audit = Audit::log('Sent email blast', $blast->subject);

        return response()->json(['item' => $blast->load('sender')->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(EmailBlast $blast): JsonResponse
    {
        $subject = $blast->subject;
        $blast->delete();
        $audit = Audit::log('Deleted email blast', $subject);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /**
     * The whitelist both writes share. The HTML body is stored as rendered —
     * running it through Html::clean would strip the inline styles the mailer
     * template depends on. It is only ever previewed in a sandboxed iframe
     * inside the permission-gated CMS, never served to clients or the site.
     */
    private function validated(Request $request, bool $required): array
    {
        $when = $required ? 'required' : 'sometimes';

        $data = $request->validate([
            'kind' => [$when, 'in:newsletter,report,adhoc'],
            'subject' => [$when, 'string', 'max:300'],
            'htmlBody' => ['sometimes', 'nullable', 'string', 'max:2000000'],
            'reportId' => ['sometimes', 'nullable', 'integer', 'exists:reports,id'],
            'newsletterIssueId' => ['sometimes', 'nullable', 'integer', 'exists:newsletter_issues,id'],
            'externalLink' => ['sometimes', 'nullable', 'url', 'max:500'],
            'recipients' => [$when, 'array', 'max:2000'],
            'recipients.*.email' => ['required', 'email', 'max:190'],
            'recipients.*.name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'recipients.*.userId' => ['sometimes', 'nullable', 'string', 'max:20'],
            'recipients.*.source' => ['required', 'in:client,subscriber,manual'],
            'status' => ['sometimes', 'in:draft,ready'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        $out = [];
        foreach (['kind', 'subject', 'status', 'notes'] as $key) {
            if (array_key_exists($key, $data)) {
                $out[$key] = $data[$key];
            }
        }
        if (array_key_exists('htmlBody', $data)) {
            $out['html_body'] = $data['htmlBody'];
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
        if (array_key_exists('recipients', $data)) {
            // Rebuilt key-by-key so nothing beyond the whitelist lands in the JSON column.
            $out['recipients'] = array_values(array_map(fn (array $r) => [
                'email' => mb_strtolower($r['email']),
                'name' => $r['name'] ?? null,
                'userId' => $r['userId'] ?? null,
                'source' => $r['source'],
            ], $data['recipients']));
        }

        return $out;
    }
}
