<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends CrmsController
{
    private const RULES = [
        'name' => ['required', 'string', 'max:255'],
        'region' => ['nullable', 'string', 'max:255'],
        'monikers' => ['nullable', 'string', 'max:255'],
        'clientType' => ['nullable', 'string', 'max:120'],
    ];

    public function store(Request $request): JsonResponse
    {
        $client = Client::create($this->attributes($request->validate(self::RULES)));

        return $this->item($this->wire($client), $this->audit('Added client', $client->name), 201);
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        $client->fill($this->attributes($request->validate(self::RULES)))->save();

        return $this->item($this->wire($client), $this->audit('Updated client', $client->name));
    }

    /** Interactions are the compliance record; a client with any cannot be removed. */
    public function destroy(Client $client): JsonResponse
    {
        if ($client->interactions()->exists()) {
            return response()->json(['message' => 'This client has logged interactions and cannot be deleted. Archive it by renaming instead.'], 422);
        }
        $name = $client->name;
        $client->contacts()->delete();
        $client->addresses()->delete();
        $client->interactionTypes()->delete();
        $client->form()->delete();
        $client->delete();

        return $this->deleted($this->audit('Removed client', $name));
    }

    /* ── Addresses ────────────────────────────────────────────── */

    public function storeAddress(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:1000']]);
        $address = $client->addresses()->create(['name' => $data['name']]);

        return $this->item($address->toWire(), $this->audit('Added client address', $client->name.' · '.$data['name']), 201);
    }

    public function updateAddress(Request $request, Client $client, ClientAddress $address): JsonResponse
    {
        abort_unless((int) $address->client_id === (int) $client->id, 404);
        $data = $request->validate(['name' => ['required', 'string', 'max:1000']]);
        $address->fill(['name' => $data['name']])->save();

        return $this->item($address->toWire(), $this->audit('Updated client address', $client->name.' · '.$data['name']));
    }

    public function destroyAddress(Client $client, ClientAddress $address): JsonResponse
    {
        abort_unless((int) $address->client_id === (int) $client->id, 404);
        $client->contacts()->where('client_address_id', $address->id)->update(['client_address_id' => null]);
        $address->delete();

        return $this->deleted($this->audit('Removed client address', $client->name.' · '.$address->name));
    }

    private function attributes(array $d): array
    {
        return [
            'name' => trim($d['name']),
            'region' => $d['region'] ?? null,
            'monikers' => $d['monikers'] ?? null,
            'client_type' => $d['clientType'] ?? null,
        ];
    }

    private function wire(Client $client): array
    {
        return $client->loadCount(['contacts', 'addresses', 'interactions'])->toWire();
    }
}
