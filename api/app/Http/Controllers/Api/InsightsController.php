<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InsightPage;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InsightsController extends Controller
{
    /** Replace the /insights page composition. The CMS always sends the full document. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hero' => ['required', 'array'],
            'hero.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'hero.title' => ['required', 'string', 'max:120'],
            'hero.dek' => ['present', 'nullable', 'string', 'max:1000'],
            'hero.image' => ['present', 'nullable', 'string', 'max:500'],

            'filters' => ['required', 'array'],
            'filters.enabled' => ['required', 'boolean'],
            'filters.allLabel' => ['required', 'string', 'max:40'],
            'filters.tags' => ['present', 'array', 'max:16'],
            'filters.tags.*' => ['required', 'string', 'max:60'],

            'list' => ['required', 'array'],
            'list.limit' => ['required', 'integer', 'min:0', 'max:200'],
            'list.showExcerpt' => ['required', 'boolean'],
            'list.showAuthor' => ['required', 'boolean'],
            'list.showDate' => ['required', 'boolean'],
            'list.featureLead' => ['required', 'boolean'],
            'list.noteHref' => ['required', 'string', 'max:200'],
            'list.emptyText' => ['required', 'string', 'max:300'],

            'cta' => ['required', 'array'],
            'cta.enabled' => ['required', 'boolean'],
            'cta.label' => ['required', 'string', 'max:120'],
            'cta.href' => ['required', 'string', 'max:200'],

            'newsletter' => ['required', 'array'],
            'newsletter.enabled' => ['required', 'boolean'],
        ]);

        // Rebuild key by key rather than storing the request wholesale, so
        // nothing outside the schema ever lands in the row.
        $content = [
            'hero' => [
                'eyebrow' => (string) ($data['hero']['eyebrow'] ?? ''),
                'title' => $data['hero']['title'],
                'dek' => (string) ($data['hero']['dek'] ?? ''),
                'image' => (string) ($data['hero']['image'] ?? ''),
            ],
            'filters' => [
                'enabled' => (bool) $data['filters']['enabled'],
                'allLabel' => $data['filters']['allLabel'],
                'tags' => array_values(array_unique($data['filters']['tags'])),
            ],
            'list' => [
                'limit' => (int) $data['list']['limit'],
                'showExcerpt' => (bool) $data['list']['showExcerpt'],
                'showAuthor' => (bool) $data['list']['showAuthor'],
                'showDate' => (bool) $data['list']['showDate'],
                'featureLead' => (bool) $data['list']['featureLead'],
                'noteHref' => $data['list']['noteHref'],
                'emptyText' => $data['list']['emptyText'],
            ],
            'cta' => [
                'enabled' => (bool) $data['cta']['enabled'],
                'label' => $data['cta']['label'],
                'href' => $data['cta']['href'],
            ],
            'newsletter' => [
                'enabled' => (bool) $data['newsletter']['enabled'],
            ],
        ];

        $page = InsightPage::current();
        $page->update(['content' => $content]);

        $audit = Audit::log('Updated Insights page', 'Insights page');

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Header photography for the journal, filed in the shared media library. */
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
            ($data['usedBy'] ?? '') ?: 'Insights',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }
}
