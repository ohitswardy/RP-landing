<?php

namespace App\Http\Controllers\Crms;

use App\Http\Controllers\Controller;
use App\Models\AuditEntry;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use App\Models\Crms\SellsideContact;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Shared plumbing for the /api/crms controllers: the response envelope the
 * React store expects ({item, audit}), CRMS-tagged audit rows in the CMS
 * ledger, and the snapshot builders every attendee list uses.
 */
abstract class CrmsController extends Controller
{
    protected function audit(string $action, string $target): AuditEntry
    {
        return Audit::log('CRMS · '.$action, $target);
    }

    /**
     * {item, audit} plus an optional `meta` block. Creates that stamp an
     * author pass meta.legacyUserMatched so the UI can say when the author
     * will live in the audit ledger only (see legacyUserId()).
     */
    protected function item(array $item, AuditEntry $audit, int $status = 200, ?array $meta = null): JsonResponse
    {
        $body = ['item' => $item, 'audit' => $audit->toWire()];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }

        return response()->json($body, $status);
    }

    /** The meta block for a response that stamped interactions.user_id / event.user_id. */
    protected function authorMeta(): array
    {
        return ['legacyUserMatched' => $this->legacyUserMatched(), 'legacyUserId' => ($id = $this->legacyUserId()) ? (string) $id : null];
    }

    protected function deleted(AuditEntry $audit): JsonResponse
    {
        return response()->json(['audit' => $audit->toWire()]);
    }

    /** Point-in-time copies of the chosen client contacts, in the order given. */
    protected function clientContactSnapshots(array $ids): array
    {
        return $this->snapshots(ClientContact::with('client')->whereIn('id', $ids)->get()->keyBy('id'), $ids);
    }

    protected function sellsideSnapshots(array $ids): array
    {
        return $this->snapshots(SellsideContact::whereIn('id', $ids)->get()->keyBy('id'), $ids);
    }

    protected function corporateSnapshots(array $ids): array
    {
        return $this->snapshots(Corporate::whereIn('id', $ids)->get()->keyBy('id'), $ids);
    }

    protected function corporateContactSnapshots(array $ids): array
    {
        return $this->snapshots(CorporateContact::whereIn('id', $ids)->get()->keyBy('id'), $ids);
    }

    private function snapshots($models, array $ids): array
    {
        $out = [];
        foreach (array_unique(array_map('intval', $ids)) as $id) {
            if ($m = $models->get($id)) {
                $out[] = $m->toSnapshot();
            }
        }

        return $out;
    }

    /** Minutes between two "HH:mm" times, for the contact-time column on a converted meeting. */
    protected static function minutesBetween(?string $start, ?string $end): ?string
    {
        if (! $start || ! $end) {
            return null;
        }
        [$sh, $sm] = array_pad(explode(':', $start), 2, 0);
        [$eh, $em] = array_pad(explode(':', $end), 2, 0);
        $minutes = ((int) $eh * 60 + (int) $em) - ((int) $sh * 60 + (int) $sm);

        return $minutes > 0 ? (string) $minutes : null;
    }

    /** Request-scoped memo key for the legacy user lookup. */
    private const LEGACY_USER_KEY = 'crms.legacyUserId';

    /**
     * interactions.user_id still points at the legacy `user` table, which is
     * read-only history. Resolve the signed-in staff member to their legacy
     * row by email when one exists; otherwise the author lives in the audit
     * ledger only. The lookup is memoised on the request, and a miss is
     * logged once per request so an unattributed save is never silent.
     */
    protected function legacyUserId(): ?int
    {
        return self::resolveLegacyUserId();
    }

    /** Whether the signed-in staff member has a row in the legacy `user` table. */
    protected function legacyUserMatched(): bool
    {
        return self::resolveLegacyUserId() !== null;
    }

    /**
     * Shared with the bootstrap and My Activity: the legacy user id for the
     * signed-in staff member, or null (logged once per request) when the
     * legacy `user` table holds no row with their email.
     */
    public static function resolveLegacyUserId(): ?int
    {
        $request = request();
        if ($request->attributes->has(self::LEGACY_USER_KEY)) {
            return $request->attributes->get(self::LEGACY_USER_KEY);
        }

        $email = auth()->user()?->email;
        $id = null;
        if ($email) {
            try {
                $found = DB::connection('crms')->table('user')->whereRaw('LOWER(email) = ?', [mb_strtolower($email)])->value('id');
                $id = $found ? (int) $found : null;
            } catch (\Throwable) {
                $id = null;
            }
            if ($id === null) {
                Log::warning('CRMS: no legacy `user` row matches the signed-in staff email; author attribution will live in the audit ledger only.', ['email' => $email]);
            }
        }
        $request->attributes->set(self::LEGACY_USER_KEY, $id);

        return $id;
    }
}
