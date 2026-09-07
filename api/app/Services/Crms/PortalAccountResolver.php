<?php

namespace App\Services\Crms;

use App\Models\ClientActivity;
use App\Models\Crms\ClientContact;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * The bridge between a CRMS client contact and its portal account in
 * regisph.users. Read-only against the CMS database: it resolves live, never
 * copies, and the only automatic write it ever makes is client_contact.
 * portal_user_id on an exact, unique email match (CRMSmasterplan.md §7.6).
 */
class PortalAccountResolver
{
    /** Everything the contact panel needs: state, account, mismatches, suggestions. */
    public function resolve(ClientContact $contact): array
    {
        $contact->loadMissing('client');
        $account = $contact->portal_user_id ? $this->portalUser((int) $contact->portal_user_id) : null;

        $state = match (true) {
            $contact->portal_user_id === null => 'unlinked',
            $account === null => 'missing',
            default => 'linked',
        };

        return [
            'state' => $state,
            'account' => $account ? $this->accountWire($account) : null,
            'mismatches' => $account ? $this->mismatches($contact, $account) : [],
            'suggestions' => $state === 'linked' ? [] : $this->suggestions($contact)->map(fn ($u) => $this->accountWire($u))->values()->all(),
            'consumption' => $account ? $this->consumption((int) $account->id) : [],
        ];
    }

    /** Rule 1 — the only link written without a human: one client account with exactly this email. */
    public function autoLinkByEmail(ClientContact $contact): void
    {
        if ($contact->portal_user_id || ! $contact->email) {
            return;
        }
        $matches = User::where('kind', User::KIND_CLIENT)
            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($contact->email))])
            ->limit(2)->get();

        if ($matches->count() === 1) {
            $contact->forceFill(['portal_user_id' => $matches->first()->id])->saveQuietly();
        }
    }

    /** Exact-email matches first, then accounts whose firm resembles the client's name or monikers. */
    public function suggestions(ClientContact $contact): Collection
    {
        $q = User::where('kind', User::KIND_CLIENT);
        $terms = collect([$contact->client?->name])
            ->merge(preg_split('/[,;\/]+/', (string) $contact->client?->monikers))
            ->map(fn ($t) => trim((string) $t))
            ->filter(fn ($t) => mb_strlen($t) >= 3)
            ->unique()->values();

        $q->where(function ($w) use ($contact, $terms) {
            if ($contact->email) {
                $w->orWhereRaw('LOWER(email) = ?', [mb_strtolower(trim($contact->email))]);
            }
            foreach ($terms as $t) {
                $w->orWhere('firm', 'like', '%'.$t.'%');
            }
        });

        $email = mb_strtolower(trim((string) $contact->email));

        return $q->limit(8)->get()
            ->sortByDesc(fn (User $u) => $email !== '' && mb_strtolower((string) $u->email) === $email ? 1 : 0)
            ->values();
    }

    /** Portal reads by this account, newest first — evidenced consumption beside logged interactions. */
    public function consumption(int $userId, int $limit = 60): array
    {
        return ClientActivity::where('user_id', $userId)
            ->orderByDesc('occurred_at')->orderByDesc('id')
            ->limit($limit)->get()
            ->map(fn (ClientActivity $a) => [
                'id' => (string) $a->id,
                'event' => $a->event,
                'target' => $a->target,
                'context' => $a->context,
                'reportId' => $a->report_id !== null ? (string) $a->report_id : null,
                'at' => $a->occurred_at->toIso8601String(),
            ])->values()->all();
    }

    /** Fields held on both sides that disagree — flagged, never overwritten. */
    private function mismatches(ClientContact $contact, User $u): array
    {
        $out = [];
        $pairs = [
            ['email', $contact->email, $u->email],
            ['phone', $contact->contact_no ?: $contact->mobile_no, $u->phone],
            ['position', $contact->position, $u->position],
            ['firm', $contact->client?->name, $u->firm],
        ];
        foreach ($pairs as [$field, $crms, $portal]) {
            $a = mb_strtolower(trim((string) $crms));
            $b = mb_strtolower(trim((string) $portal));
            if ($a !== '' && $b !== '' && $a !== $b) {
                $out[] = ['field' => $field, 'crms' => $crms, 'portal' => $portal];
            }
        }

        return $out;
    }

    private function portalUser(int $id): ?User
    {
        return User::where('kind', User::KIND_CLIENT)->find($id);
    }

    public function accountWire(User $u): array
    {
        return [
            'id' => (string) $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'username' => $u->username,
            'phone' => $u->phone,
            'position' => $u->position,
            'firm' => $u->firm,
            'clientType' => $u->client_type,
            'sectorPrefs' => $u->sector_prefs ?? [],
            'preferredAnalysts' => $u->preferred_analysts ?? [],
            'status' => $u->status,
            'suspended' => (bool) $u->suspended,
            'lastActive' => $u->last_active_at?->toIso8601String(),
            'approvedAt' => $u->approved_at?->toIso8601String(),
        ];
    }
}
