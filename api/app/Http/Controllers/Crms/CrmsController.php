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

    protected function item(array $item, AuditEntry $audit, int $status = 200): JsonResponse
    {
        return response()->json(['item' => $item, 'audit' => $audit->toWire()], $status);
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

    /**
     * interactions.user_id still points at the legacy `user` table, which is
     * read-only history. Resolve the signed-in staff member to their legacy
     * row by email when one exists; otherwise the author lives in the audit
     * ledger only.
     */
    protected function legacyUserId(): ?int
    {
        $email = auth()->user()?->email;
        if (! $email) {
            return null;
        }
        try {
            $id = DB::connection('crms')->table('user')->whereRaw('LOWER(email) = ?', [mb_strtolower($email)])->value('id');

            return $id ? (int) $id : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
