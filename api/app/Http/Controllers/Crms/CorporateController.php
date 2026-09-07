<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Corporates and the issuer-side contacts under them. */
class CorporateController extends CrmsController
{
    private const RULES = [
        'name' => ['required', 'string', 'max:255'],
        'ticker' => ['nullable', 'string', 'max:40'],
        'identifiers1' => ['nullable', 'string', 'max:255'],
        'identifiers2' => ['nullable', 'string', 'max:255'],
        'address' => ['nullable', 'string', 'max:2000'],
        'sectorGeneric' => ['nullable', 'string', 'max:255'],
        'sectorGmo' => ['nullable', 'string', 'max:255'],
        'sectorJpmorgan' => ['nullable', 'string', 'max:255'],
        'sectorSchroders' => ['nullable', 'string', 'max:255'],
        'sectorTrowe' => ['nullable', 'string', 'max:255'],
    ];

    private const CONTACT_RULES = [
        'corporateId' => ['nullable', 'integer'],
        'name' => ['required', 'string', 'max:255'],
        'position' => ['nullable', 'string', 'max:255'],
        'address' => ['nullable', 'string', 'max:255'],
        'email' => ['nullable', 'email', 'max:255'],
        'mobile' => ['nullable', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:255'],
        'assistant' => ['nullable', 'string', 'max:255'],
        'assistantEmail' => ['nullable', 'email', 'max:255'],
        'analystIds' => ['sometimes', 'array', 'max:20'],
        'analystIds.*' => ['integer'],
    ];

    public function store(Request $request): JsonResponse
    {
        $corporate = Corporate::create($this->attributes($request->validate(self::RULES)));

        return $this->item($corporate->loadCount('contacts')->toWire(), $this->audit('Added corporate', $this->label($corporate)), 201);
    }

    public function update(Request $request, Corporate $corporate): JsonResponse
    {
        $corporate->fill($this->attributes($request->validate(self::RULES)))->save();

        return $this->item($corporate->loadCount('contacts')->toWire(), $this->audit('Updated corporate', $this->label($corporate)));
    }

    public function destroy(Corporate $corporate): JsonResponse
    {
        $label = $this->label($corporate);
        $corporate->contacts()->update(['corporate_id' => null]);
        $corporate->sectorGroups()->detach();
        $corporate->delete();

        return $this->deleted($this->audit('Removed corporate', $label));
    }

    /* ── Corporate contacts ───────────────────────────────────── */

    public function storeContact(Request $request): JsonResponse
    {
        $data = $request->validate(self::CONTACT_RULES);
        $contact = CorporateContact::create($this->contactAttributes($data));
        $this->syncEmbedded($contact);

        return $this->item($contact->load('corporate')->toWire(), $this->audit('Added corporate contact', $contact->name), 201);
    }

    public function updateContact(Request $request, CorporateContact $contact): JsonResponse
    {
        $data = $request->validate(self::CONTACT_RULES);
        $previous = $contact->corporate_id;
        $contact->fill($this->contactAttributes($data))->save();
        $this->syncEmbedded($contact, $previous);

        return $this->item($contact->load('corporate')->toWire(), $this->audit('Updated corporate contact', $contact->name));
    }

    public function destroyContact(CorporateContact $contact): JsonResponse
    {
        $name = $contact->name;
        $previous = $contact->corporate_id;
        $contact->delete();
        $this->syncEmbedded($contact, $previous);

        return $this->deleted($this->audit('Removed corporate contact', $name));
    }

    private function attributes(array $d): array
    {
        return [
            'name' => trim($d['name']),
            'ticker' => isset($d['ticker']) ? strtoupper(trim($d['ticker'])) : null,
            'identifiers1' => $d['identifiers1'] ?? null,
            'identifiers2' => $d['identifiers2'] ?? null,
            'address' => $d['address'] ?? null,
            'sector_generic' => $d['sectorGeneric'] ?? null,
            'sector_gmo' => $d['sectorGmo'] ?? null,
            'sector_jpmorgan' => $d['sectorJpmorgan'] ?? null,
            'sector_schroders' => $d['sectorSchroders'] ?? null,
            'sector_trowe' => $d['sectorTrowe'] ?? null,
        ];
    }

    private function contactAttributes(array $d): array
    {
        $attrs = [
            'corporate_id' => $d['corporateId'] ?? null,
            'name' => trim($d['name']),
            'position' => $d['position'] ?? null,
            'address' => $d['address'] ?? null,
            'email' => isset($d['email']) ? mb_strtolower(trim($d['email'])) : null,
            'mobile' => $d['mobile'] ?? null,
            'phone' => $d['phone'] ?? null,
            'assistant' => $d['assistant'] ?? null,
            'assistant_email' => $d['assistantEmail'] ?? null,
        ];
        if (array_key_exists('analystIds', $d)) {
            $attrs['analyst'] = $this->sellsideSnapshots($d['analystIds']);
        }

        return $attrs;
    }

    /**
     * The legacy app reads a corporate's people from corporate.corporate_contacts
     * (embedded JSON). Keep that mirror current while both apps share the table.
     */
    private function syncEmbedded(CorporateContact $contact, ?int $previousCorporateId = null): void
    {
        foreach (array_unique(array_filter([$contact->corporate_id, $previousCorporateId])) as $id) {
            if ($corporate = Corporate::find($id)) {
                $corporate->corporate_contacts = $corporate->contacts()->orderBy('name')->get()->map->toSnapshot()->all();
                $corporate->save();
            }
        }
    }

    private function label(Corporate $c): string
    {
        return ($c->ticker ? $c->ticker.' · ' : '').$c->name;
    }
}
