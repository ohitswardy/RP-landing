<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NewsletterIssue;
use App\Support\Audit;
use App\Support\Html;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewsletterController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, creating: true);

        $issue = NewsletterIssue::create([
            ...$data,
            'intro' => $data['intro'] ?? '',
            'sections' => $data['sections'] ?? [],
            'rail' => $data['rail'] ?? [],
        ]);

        $audit = Audit::log('Filed '.$issue->cadence.' issue', $issue->subject);

        return response()->json(['item' => $issue->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, NewsletterIssue $issue): JsonResponse
    {
        $data = $this->validated($request, creating: false);

        $issue->fill($data)->save();

        $audit = Audit::log('Updated '.$issue->cadence.' issue', $issue->subject);

        return response()->json(['item' => $issue->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(NewsletterIssue $issue): JsonResponse
    {
        $subject = $issue->subject;
        $cadence = $issue->cadence;
        $issue->delete();
        $audit = Audit::log('Deleted '.$cadence.' issue', $subject);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /** Chart images for issue sections, filed in the shared media library. */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => MediaLibrary::IMAGE_RULES,
            'label' => ['nullable', 'string', 'max:120'],
            'usedBy' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', 'in:photo,graphic,portrait'],
        ]);

        $asset = MediaLibrary::store(
            $request->file('file'),
            $data['label'] ?? '',
            ($data['usedBy'] ?? '') ?: 'Newsletter',
            $data['kind'] ?? 'graphic',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }

    /**
     * Shared schema for store and update. Sections are rebuilt key by key
     * so nothing outside the schema ever lands in the JSON column.
     */
    private function validated(Request $request, bool $creating): array
    {
        $presence = $creating ? 'required' : 'sometimes';

        $data = $request->validate([
            'cadence' => [$presence, 'in:daily,weekly,monthly'],
            'date' => [$presence, 'date'],
            'subject' => [$presence, 'string', 'max:300'],
            'intro' => ['sometimes', 'nullable', 'string', 'max:60000'],
            'sections' => ['sometimes', 'array', 'max:60'],
            'sections.*.badge' => ['present', 'nullable', 'string', 'max:80'],
            'sections.*.title' => ['present', 'nullable', 'string', 'max:300'],
            'sections.*.body' => ['present', 'nullable', 'string', 'max:60000'],
            'sections.*.aside' => ['present', 'nullable', 'string', 'max:60000'],
            'sections.*.images' => ['present', 'array', 'max:12'],
            'sections.*.images.*' => ['required', 'string', 'max:500'],
            // The monthly right-hand rail: a heading and a graphic per block.
            'rail' => ['sometimes', 'array', 'max:12'],
            'rail.*.title' => ['present', 'nullable', 'string', 'max:160'],
            'rail.*.image' => ['present', 'nullable', 'string', 'max:500'],
            'rail.*.wide' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('intro', $data)) {
            $data['intro'] = Html::clean($data['intro'] ?? '');
        }

        if (array_key_exists('sections', $data)) {
            $data['sections'] = array_values(array_map(static fn (array $s): array => [
                'badge' => (string) ($s['badge'] ?? ''),
                'title' => (string) ($s['title'] ?? ''),
                'body' => Html::clean($s['body'] ?? ''),
                'aside' => Html::clean($s['aside'] ?? ''),
                'images' => array_values($s['images']),
            ], $data['sections']));
        }

        if (array_key_exists('rail', $data)) {
            // Rebuilt key by key, plain text throughout — a rail block
            // prints as a heading and an image, never as markup. Blocks
            // with neither drop out, so an emptied rail stores as [] and
            // the commentary goes back to full width.
            $rail = array_map(static fn (array $b): array => [
                'title' => (string) ($b['title'] ?? ''),
                'image' => (string) ($b['image'] ?? ''),
                // A wide block spans the sheet on its own row.
                'wide' => (bool) ($b['wide'] ?? false),
            ], $data['rail']);

            $data['rail'] = array_values(array_filter(
                $rail,
                static fn (array $b): bool => trim($b['title'].$b['image']) !== '',
            ));
        }

        return $data;
    }
}
