<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceLine;
use App\Models\ServicePage;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /** Wire keys that arrive camel-cased and land on snake_cased columns. */
    private const ALIASES = [
        'introHeading' => 'intro_heading',
        'heroImages' => 'hero_images',
    ];

    public function update(Request $request, ServiceLine $service): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:120'],
            'eyebrow' => ['sometimes', 'nullable', 'string', 'max:60'],
            'dek' => ['sometimes', 'string', 'max:1000'],
            'introHeading' => ['sometimes', 'string', 'max:160'],
            'img' => ['sometimes', 'nullable', 'string', 'max:500'],
            'heroImages' => ['sometimes', 'array', 'max:8'],
            'heroImages.*' => ['string', 'max:500'],
            'pillars' => ['sometimes', 'array', 'max:12'],
            'pillars.*.title' => ['required', 'string', 'max:120'],
            'pillars.*.body' => ['required', 'string', 'max:600'],
            'proof' => ['sometimes', 'array', 'max:4'],
            'proof.*.value' => ['required', 'string', 'max:40'],
            'proof.*.label' => ['required', 'string', 'max:60'],
            'live' => ['sometimes', 'boolean'],
        ]);

        $liveChanged = array_key_exists('live', $data) && (bool) $data['live'] !== $service->live;

        $attributes = [];
        foreach ($data as $key => $value) {
            $column = self::ALIASES[$key] ?? $key;
            $attributes[$column] = match ($column) {
                'pillars' => array_map(fn ($p) => ['title' => $p['title'], 'body' => $p['body']], $value),
                'proof' => array_map(fn ($p) => ['value' => $p['value'], 'label' => $p['label']], $value),
                'hero_images' => array_values($value),
                'eyebrow', 'img' => (string) $value,
                default => $value,
            };
        }

        $service->fill($attributes)->save();

        $audit = Audit::log(
            $liveChanged
                ? ($service->live ? 'Published service line' : 'Unpublished service line')
                : 'Updated service line',
            $service->title,
        );

        return response()->json(['item' => $service->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Card order on /services, given as the full list of ids top to bottom. */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        foreach ($data['ids'] as $index => $id) {
            ServiceLine::whereKey($id)->update(['position' => $index]);
        }

        $items = ServiceLine::orderBy('position')->orderBy('id')->get()->map->toWire()->values();
        $audit = Audit::log('Reordered service lines', 'Services landing page');

        return response()->json(['items' => $items, 'audit' => $audit->toWire()]);
    }

    /** The /services landing page itself — header copy and hero photo. */
    public function updatePage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'eyebrow' => ['sometimes', 'nullable', 'string', 'max:60'],
            'title' => ['sometimes', 'string', 'max:120'],
            'dek' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'heroImage' => ['sometimes', 'nullable', 'string', 'max:500'],
            'cardCta' => ['sometimes', 'string', 'max:80'],
        ]);

        $page = ServicePage::current();

        // Key-presence, not `??`: the empty-string-to-null middleware would
        // otherwise make "clear this field" read as "leave it alone".
        $page->fill([
            'eyebrow' => array_key_exists('eyebrow', $data) ? (string) $data['eyebrow'] : $page->eyebrow,
            'title' => $data['title'] ?? $page->title,
            'dek' => array_key_exists('dek', $data) ? (string) $data['dek'] : $page->dek,
            'hero_image' => array_key_exists('heroImage', $data) ? (string) $data['heroImage'] : $page->hero_image,
            'card_cta' => $data['cardCta'] ?? $page->card_cta,
        ])->save();

        $audit = Audit::log('Updated services landing page', $page->title);

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }

    /**
     * Accept a photo for a service page. The file lands on the public disk
     * and is registered in the media library, so it is reusable elsewhere.
     */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => MediaLibrary::IMAGE_RULES,
            'label' => ['nullable', 'string', 'max:120'],
            'usedBy' => ['nullable', 'string', 'max:120'],
        ]);

        $asset = MediaLibrary::store(
            $request->file('file'),
            $data['label'] ?? '',
            ($data['usedBy'] ?? '') ?: 'Services',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }
}
