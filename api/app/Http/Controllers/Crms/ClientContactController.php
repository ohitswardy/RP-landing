<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\ClientContact;
use App\Models\User;
use App\Services\Crms\PortalAccountResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientContactController extends CrmsController
{
    public function __construct(private readonly PortalAccountResolver $portal) {}

    private function rules(): array
    {
        return [
            'clientId' => ['required', 'integer'],
            'addressId' => ['nullable', 'integer'],
            'firstName' => ['required', 'string', 'max:255'],
            'lastName' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'contactNo' => ['nullable', 'string', 'max:255'],
            'mobileNo' => ['nullable', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'assistant' => ['nullable', 'string', 'max:255'],
            'assistantEmail' => ['nullable', 'email', 'max:255'],
            'assistantContactNo' => ['nullable', 'string', 'max:255'],
            'ownIds' => ['sometimes', 'array', 'max:300'],
            'ownIds.*' => ['integer'],
            'watchlistIds' => ['sometimes', 'array', 'max:300'],
            'watchlistIds.*' => ['integer'],
            'coverageTeamIds' => ['sometimes', 'array', 'max:50'],
            'coverageTeamIds.*' => ['integer'],
            'salesIds' => ['sometimes', 'array', 'max:50'],
            'salesIds.*' => ['integer'],
            'sectorGroupIds' => ['sometimes', 'array', 'max:100'],
            'sectorGroupIds.*' => ['integer'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $contact = ClientContact::create($this->attributes($data));
        $this->sync($contact, $data);
        $this->portal->autoLinkByEmail($contact);

        return $this->item($this->wire($contact), $this->audit('Added client contact', $contact->fullName()), 201);
    }

    public function update(Request $request, ClientContact $contact): JsonResponse
    {
        $data = $request->validate($this->rules());
        $contact->fill($this->attributes($data))->save();
        $this->sync($contact, $data);
        $this->portal->autoLinkByEmail($contact);

        return $this->item($this->wire($contact), $this->audit('Updated client contact', $contact->fullName()));
    }

    public function destroy(ClientContact $contact): JsonResponse
    {
        $name = $contact->fullName();
        $contact->sectorGroups()->detach();
        $contact->delete();

        return $this->deleted($this->audit('Removed client contact', $name));
    }

    /* ── Portal bridge (§7.6) ─────────────────────────────────── */

    public function portal(ClientContact $contact): JsonResponse
    {
        return response()->json($this->portal->resolve($contact));
    }

    /** Link (portalUserId) or unlink (null). Always audited; never touches `users`. */
    public function link(Request $request, ClientContact $contact): JsonResponse
    {
        $data = $request->validate(['portalUserId' => ['nullable', 'integer']]);
        $id = $data['portalUserId'] ?? null;

        if ($id !== null && ! User::where('kind', User::KIND_CLIENT)->whereKey($id)->exists()) {
            return response()->json(['message' => 'That portal account no longer exists.'], 422);
        }

        $contact->forceFill(['portal_user_id' => $id])->save();
        $audit = $this->audit($id ? 'Linked portal account' : 'Unlinked portal account', $contact->fullName());

        return response()->json([
            'item' => $this->wire($contact),
            'portal' => $this->portal->resolve($contact),
            'audit' => $audit->toWire(),
        ]);
    }

    private function attributes(array $d): array
    {
        return [
            'client_id' => $d['clientId'],
            'client_address_id' => $d['addressId'] ?? null,
            'firstname' => trim($d['firstName']),
            'lastname' => $d['lastName'] ?? null,
            'email' => isset($d['email']) ? mb_strtolower(trim($d['email'])) : null,
            'contact_no' => $d['contactNo'] ?? null,
            'mobile_no' => $d['mobileNo'] ?? null,
            'position' => $d['position'] ?? null,
            'country' => $d['country'] ?? null,
            'assistant' => $d['assistant'] ?? null,
            'assistant_email' => $d['assistantEmail'] ?? null,
            'assistant_contact_no' => $d['assistantContactNo'] ?? null,
        ];
    }

    /** The JSON snapshot lists and the sector pivot, only when the payload names them. */
    private function sync(ClientContact $contact, array $d): void
    {
        $dirty = false;
        if (array_key_exists('ownIds', $d)) {
            $contact->own = $this->corporateSnapshots($d['ownIds']);
            $dirty = true;
        }
        if (array_key_exists('watchlistIds', $d)) {
            $contact->watchlist = $this->corporateSnapshots($d['watchlistIds']);
            $dirty = true;
        }
        if (array_key_exists('coverageTeamIds', $d)) {
            $contact->coverage_team = $this->sellsideSnapshots($d['coverageTeamIds']);
            $dirty = true;
        }
        if (array_key_exists('salesIds', $d)) {
            $contact->sales = $this->sellsideSnapshots($d['salesIds']);
            $dirty = true;
        }
        if ($dirty) {
            $contact->save();
        }
        if (array_key_exists('sectorGroupIds', $d)) {
            $contact->sectorGroups()->sync($d['sectorGroupIds']);
        }
    }

    private function wire(ClientContact $contact): array
    {
        return $contact->refresh()->load(['client', 'sectorGroups'])->toWire();
    }
}
