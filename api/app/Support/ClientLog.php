<?php

namespace App\Support;

use App\Models\ClientActivity;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The client-portal activity ledger. Every event is chained to the one
 * before it with an HMAC-SHA256 over the row payload plus the previous
 * hash, keyed by the app secret — so the chain cannot be recomputed from
 * database access alone, and verify() pinpoints the first altered row.
 */
class ClientLog
{
    /** Record one consumption event for the signed-in portal client. */
    public static function record(Request $request, string $event, ?Report $report, string $context = ''): ClientActivity
    {
        /** @var User $user */
        $user = $request->user();

        $row = [
            'user_id' => $user->id,
            'actor_name' => $user->name,
            'actor_email' => $user->email,
            'actor_firm' => $user->firm,
            'event' => $event,
            'report_id' => $report?->id,
            'target' => $report?->title ?? '',
            'context' => mb_substr($context, 0, 40),
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'occurred_at' => now(),
        ];

        // Serialize appends so each row locks onto the true chain head.
        return DB::transaction(function () use ($row) {
            $head = ClientActivity::orderByDesc('id')->lockForUpdate()->first();
            $row['prev_hash'] = $head?->hash;
            $row['hash'] = self::seal($row, $row['prev_hash']);

            return ClientActivity::create($row);
        });
    }

    /**
     * Walk the whole chain and recompute every hash.
     *
     * @return array{intact: bool, checked: int, brokenAt: string|null}
     */
    public static function verify(): array
    {
        $checked = 0;
        $brokenAt = null;
        $prevHash = null;

        ClientActivity::orderBy('id')->chunk(500, function ($rows) use (&$checked, &$brokenAt, &$prevHash) {
            foreach ($rows as $row) {
                $expected = self::seal($row->getAttributes(), $prevHash);
                if ($row->prev_hash !== $prevHash || ! hash_equals($expected, $row->hash)) {
                    $brokenAt = (string) $row->id;

                    return false; // stop chunking at the first break
                }
                $prevHash = $row->hash;
                $checked++;
            }

            return true;
        });

        return ['intact' => $brokenAt === null, 'checked' => $checked, 'brokenAt' => $brokenAt];
    }

    /** Canonical HMAC for a row. Field order is part of the contract. */
    private static function seal(array $row, ?string $prevHash): string
    {
        $at = $row['occurred_at'];
        $payload = implode('|', [
            (string) ($row['user_id'] ?? ''),
            $row['actor_name'],
            $row['actor_email'],
            (string) ($row['actor_firm'] ?? ''),
            $row['event'],
            (string) ($row['report_id'] ?? ''),
            $row['target'],
            $row['context'] ?? '',
            (string) ($row['ip'] ?? ''),
            (string) ($row['user_agent'] ?? ''),
            $at instanceof \DateTimeInterface ? $at->format('Y-m-d H:i:s') : (string) $at,
            (string) ($prevHash ?? ''),
        ]);

        return hash_hmac('sha256', $payload, config('app.key'));
    }
}
