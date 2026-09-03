<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DistributionList;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Saved audiences for the Email desk. A list is a named set of contacts
 * built from the recipient pool; the composer and the newsletter blast
 * panel pick lists instead of rebuilding the same segment each time.
 */
class DistributionListController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'items' => DistributionList::with('creator')->orderBy('name')->get()->map->toWire()->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);

        $list = DistributionList::create($data + ['created_by' => $request->user()->id]);
        $audit = Audit::log('Created distribution list', $list->name);

        return response()->json(['item' => $list->load('creator')->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, DistributionList $list): JsonResponse
    {
        $data = $this->validated($request, $list);

        $list->fill($data)->save();
        $audit = Audit::log('Updated distribution list', $list->name);

        return response()->json(['item' => $list->load('creator')->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(DistributionList $list): JsonResponse
    {
        $name = $list->name;
        $list->delete();
        $audit = Audit::log('Deleted distribution list', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }

    private function validated(Request $request, ?DistributionList $list): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120', Rule::unique('distribution_lists', 'name')->ignore($list?->id)],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'contacts' => ['present', 'array', 'max:2000'],
            'contacts.*.email' => ['required', 'email', 'max:190'],
            'contacts.*.name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contacts.*.userId' => ['sometimes', 'nullable', 'string', 'max:20'],
            'contacts.*.source' => ['required', 'in:client,subscriber,manual'],
        ]);

        // Rebuilt key-by-key and deduplicated by address, first entry wins.
        $seen = [];
        $contacts = [];
        foreach ($data['contacts'] as $c) {
            $email = mb_strtolower(trim($c['email']));
            if (isset($seen[$email])) {
                continue;
            }
            $seen[$email] = true;
            $contacts[] = [
                'email' => $email,
                'name' => $c['name'] ?? null,
                'userId' => $c['userId'] ?? null,
                'source' => $c['source'],
            ];
        }

        return [
            'name' => trim($data['name']),
            'description' => array_key_exists('description', $data) ? ($data['description'] ?: null) : ($list?->description),
            'contacts' => $contacts,
        ];
    }
}
