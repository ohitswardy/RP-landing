<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DistributionList;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Saved audiences for the Email desk. A list is a named set of contacts
 * built from the recipient pool; the composer and the newsletter blast
 * panel pick lists instead of rebuilding the same segment each time.
 *
 * Lists are personal: every Administrator and Analyst keeps their own, and
 * only the owner sees, edits or deletes one. A list whose owner account was
 * deleted is left ownerless and visible to everyone until someone edits
 * it, at which point they take it over.
 */
class DistributionListController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['items' => $this->ownListsWire($request->user())]);
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
        $this->guardOwner($request->user(), $list);
        $data = $this->validated($request, $list);

        $list->fill($data + ['created_by' => $request->user()->id])->save();
        $audit = Audit::log('Updated distribution list', $list->name);

        return response()->json(['item' => $list->load('creator')->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(Request $request, DistributionList $list): JsonResponse
    {
        $this->guardOwner($request->user(), $list);
        $name = $list->name;
        $list->delete();
        $audit = Audit::log('Deleted distribution list', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /** The lists this staff member may pick from: their own, plus any left ownerless. */
    public static function ownListsWire(User $actor): array
    {
        return DistributionList::with('creator')
            ->where(fn ($q) => $q->where('created_by', $actor->id)->orWhereNull('created_by'))
            ->orderBy('name')
            ->get()
            ->map->toWire()
            ->values()
            ->all();
    }

    private function guardOwner(User $actor, DistributionList $list): void
    {
        abort_if($list->created_by !== null && (int) $list->created_by !== (int) $actor->id, 403, 'That distribution list belongs to another staff member.');
    }

    private function validated(Request $request, ?DistributionList $list): array
    {
        $ownerId = $request->user()->id;
        $data = $request->validate([
            'name' => [
                'required', 'string', 'min:2', 'max:120',
                Rule::unique('distribution_lists', 'name')->where('created_by', $ownerId)->ignore($list?->id),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'contacts' => ['present', 'array', 'max:2000'],
            'contacts.*.email' => ['required', 'email', 'max:190'],
            'contacts.*.name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'contacts.*.userId' => ['sometimes', 'nullable', 'string', 'max:20'],
            'contacts.*.source' => ['required', 'in:client,subscriber,manual'],
        ], ['name.unique' => 'You already have a list with that name.']);

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
