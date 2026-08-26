<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffMember;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PersonController extends Controller
{
    private const TEAMS = ['Board of Directors', 'Research', 'Sales & Trading', 'Operations'];

    /** Everything a profile card carries, beyond name and team. */
    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:120'],
            'team' => [$required, 'in:'.implode(',', self::TEAMS)],
            'roles' => ['sometimes', 'array', 'min:1', 'max:3'],
            'roles.*' => ['required', 'string', 'max:120'],
            'bio' => ['sometimes', 'array', 'max:6'],
            'bio.*' => ['required', 'string', 'max:3000'],
            'sectors' => ['sometimes', 'array', 'max:8'],
            'sectors.*' => ['required', 'string', 'max:60'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:160'],
            'img' => ['sometimes', 'nullable', 'string', 'max:500'],
            'visible' => ['sometimes', 'boolean'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(true));

        $person = StaffMember::create([
            'name' => $data['name'],
            'team' => $data['team'],
            'roles' => $data['roles'] ?? [],
            'bio' => $data['bio'] ?? [],
            'sectors' => $data['sectors'] ?? [],
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'img' => $data['img'] ?? '',
            // Hidden unless the editor explicitly publishes on create.
            'visible' => (bool) ($data['visible'] ?? false),
            'position' => (int) StaffMember::max('position') + 1,
        ]);

        $audit = Audit::log('Added profile', $person->name);

        return response()->json(['item' => $person->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, StaffMember $person): JsonResponse
    {
        $data = $request->validate($this->rules(false));

        $visibilityChanged = array_key_exists('visible', $data) && (bool) $data['visible'] !== $person->visible;

        // Key-presence, not `??`: the empty-string-to-null middleware would
        // otherwise make "clear this field" read as "leave it alone".
        $has = fn (string $key) => array_key_exists($key, $data);

        $person->fill([
            'name' => $data['name'] ?? $person->name,
            'team' => $data['team'] ?? $person->team,
            'roles' => $has('roles') ? array_values($data['roles']) : $person->roles,
            'bio' => $has('bio') ? array_values($data['bio']) : $person->bio,
            'sectors' => $has('sectors') ? array_values($data['sectors']) : $person->sectors,
            'phone' => $has('phone') ? (string) $data['phone'] : $person->phone,
            'email' => $has('email') ? (string) $data['email'] : $person->email,
            'img' => $has('img') ? (string) $data['img'] : $person->img,
            'visible' => $has('visible') ? (bool) $data['visible'] : $person->visible,
        ])->save();

        $audit = Audit::log(
            $visibilityChanged ? ($person->visible ? 'Restored profile' : 'Hid profile') : 'Updated profile',
            $person->name,
        );

        return response()->json(['item' => $person->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(StaffMember $person): JsonResponse
    {
        $name = $person->name;
        $person->delete();
        $audit = Audit::log('Removed profile', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        foreach ($data['ids'] as $index => $id) {
            StaffMember::whereKey($id)->update(['position' => $index]);
        }

        $items = StaffMember::orderBy('position')->orderBy('id')->get()->map->toWire()->values();

        return response()->json(['items' => $items]);
    }

    /** Accept a portrait and file it in the media library. */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => MediaLibrary::IMAGE_RULES,
            'label' => ['nullable', 'string', 'max:120'],
            'usedBy' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', 'in:photo,portrait,graphic'],
        ]);

        $kind = $data['kind'] ?? 'portrait';
        $asset = MediaLibrary::store(
            $request->file('file'),
            $data['label'] ?? '',
            ($data['usedBy'] ?? '') ?: 'People of Regis',
            $kind,
        );

        $audit = Audit::log($kind === 'portrait' ? 'Uploaded portrait' : 'Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }
}
