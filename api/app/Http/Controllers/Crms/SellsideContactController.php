<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\SellsideContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellsideContactController extends CrmsController
{
    private const RULES = [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255'],
        'type' => ['nullable', 'string', 'in:Analyst,Sales,N/A'],
        'position' => ['nullable', 'string', 'max:255'],
        'officeNo' => ['nullable', 'string', 'max:255'],
        'mobileNo' => ['nullable', 'string', 'max:255'],
    ];

    public function store(Request $request): JsonResponse
    {
        $contact = SellsideContact::create($this->attributes($request->validate(self::RULES)));

        return $this->item($contact->toWire(), $this->audit('Added sellside contact', $contact->name), 201);
    }

    public function update(Request $request, SellsideContact $contact): JsonResponse
    {
        $contact->fill($this->attributes($request->validate(self::RULES)))->save();

        return $this->item($contact->toWire(), $this->audit('Updated sellside contact', $contact->name));
    }

    public function destroy(SellsideContact $contact): JsonResponse
    {
        $name = $contact->name;
        $contact->delete();

        return $this->deleted($this->audit('Removed sellside contact', $name));
    }

    private function attributes(array $d): array
    {
        return [
            'name' => trim($d['name']),
            'email' => mb_strtolower(trim($d['email'])),
            'type' => $d['type'] ?? null,
            'position' => $d['position'] ?? null,
            'office_no' => $d['officeNo'] ?? null,
            'mobile_no' => $d['mobileNo'] ?? null,
        ];
    }
}
