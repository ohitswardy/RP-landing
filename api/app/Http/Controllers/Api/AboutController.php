<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AboutPage;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AboutController extends Controller
{
    /** Replace the About page copy. The CMS always sends the full document. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hero' => ['required', 'array'],
            'hero.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'hero.title' => ['required', 'string', 'max:60'],
            'hero.image' => ['present', 'nullable', 'string', 'max:500'],

            'overview' => ['required', 'array'],
            'overview.heading' => ['required', 'string', 'max:120'],
            'overview.paragraphs' => ['present', 'array', 'max:8'],
            'overview.paragraphs.*' => ['required', 'string', 'max:2000'],
            'overview.profile' => ['present', 'array', 'max:10'],
            'overview.profile.*.label' => ['required', 'string', 'max:60'],
            'overview.profile.*.value' => ['required', 'string', 'max:160'],

            'heritage' => ['required', 'array'],
            'heritage.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'heritage.heading' => ['required', 'string', 'max:120'],
            'heritage.timeline' => ['present', 'array', 'max:12'],
            'heritage.timeline.*.year' => ['required', 'string', 'max:12'],
            'heritage.timeline.*.title' => ['required', 'string', 'max:120'],
            'heritage.timeline.*.body' => ['required', 'string', 'max:300'],

            'leadership' => ['required', 'array'],
            'leadership.heading' => ['required', 'string', 'max:160'],

            'awards' => ['required', 'array'],
            'awards.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'awards.heading' => ['required', 'string', 'max:160'],
            'awards.groups' => ['present', 'array', 'max:8'],
            'awards.groups.*.org' => ['required', 'string', 'max:120'],
            'awards.groups.*.items' => ['required', 'array', 'min:1', 'max:10'],
            'awards.groups.*.items.*.name' => ['required', 'string', 'max:160'],
            'awards.groups.*.items.*.years' => ['required', 'string', 'max:120'],
        ]);

        // Rebuild the document key by key rather than storing the request
        // wholesale, so nothing outside the schema ever lands in the row.
        $content = [
            'hero' => [
                'eyebrow' => (string) ($data['hero']['eyebrow'] ?? ''),
                'title' => $data['hero']['title'],
                'image' => (string) ($data['hero']['image'] ?? ''),
            ],
            'overview' => [
                'heading' => $data['overview']['heading'],
                'paragraphs' => array_values($data['overview']['paragraphs']),
                'profile' => array_map(
                    fn ($r) => ['label' => $r['label'], 'value' => $r['value']],
                    array_values($data['overview']['profile']),
                ),
            ],
            'heritage' => [
                'eyebrow' => (string) ($data['heritage']['eyebrow'] ?? ''),
                'heading' => $data['heritage']['heading'],
                'timeline' => array_map(
                    fn ($t) => ['year' => $t['year'], 'title' => $t['title'], 'body' => $t['body']],
                    array_values($data['heritage']['timeline']),
                ),
            ],
            'leadership' => [
                'heading' => $data['leadership']['heading'],
            ],
            'awards' => [
                'eyebrow' => (string) ($data['awards']['eyebrow'] ?? ''),
                'heading' => $data['awards']['heading'],
                'groups' => array_map(
                    fn ($g) => [
                        'org' => $g['org'],
                        'items' => array_map(
                            fn ($i) => ['name' => $i['name'], 'years' => $i['years']],
                            array_values($g['items']),
                        ),
                    ],
                    array_values($data['awards']['groups']),
                ),
            ],
        ];

        $page = AboutPage::current();
        $page->update(['content' => $content]);

        $audit = Audit::log('Updated About page copy', 'About page');

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }
}
