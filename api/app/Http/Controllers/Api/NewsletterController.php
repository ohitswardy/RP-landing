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

        return $data;
    }
}
