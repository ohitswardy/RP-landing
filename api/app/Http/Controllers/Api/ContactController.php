<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactPage;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    /** Replace the Contact page copy. The CMS always sends the full document. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hero' => ['required', 'array'],
            'hero.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'hero.title' => ['required', 'string', 'max:80'],
            'hero.image' => ['present', 'nullable', 'string', 'max:500'],

            'inquiry' => ['required', 'array'],
            'inquiry.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'inquiry.heading' => ['required', 'string', 'max:120'],
            'inquiry.blurb' => ['present', 'nullable', 'string', 'max:400'],
            'inquiry.deskLabel' => ['present', 'nullable', 'string', 'max:60'],
            'inquiry.deskName' => ['present', 'nullable', 'string', 'max:60'],
            'inquiry.deskPhone' => ['present', 'nullable', 'string', 'max:60'],
            'inquiry.interests' => ['present', 'array', 'min:1', 'max:8'],
            'inquiry.interests.*' => ['required', 'string', 'max:40'],
            'inquiry.submitLabel' => ['required', 'string', 'max:40'],
            'inquiry.successHeading' => ['required', 'string', 'max:80'],
            'inquiry.successBody' => ['required', 'string', 'max:600'],

            'offices' => ['required', 'array'],
            'offices.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'offices.heading' => ['required', 'string', 'max:160'],
            'offices.addressLabel' => ['present', 'nullable', 'string', 'max:40'],
            'offices.address' => ['present', 'array', 'max:8'],
            'offices.address.*' => ['required', 'string', 'max:120'],
            'offices.contactLabel' => ['present', 'nullable', 'string', 'max:40'],
            'offices.channels' => ['present', 'array', 'max:6'],
            'offices.channels.*.label' => ['required', 'string', 'max:12'],
            'offices.channels.*.value' => ['required', 'string', 'max:160'],
            'offices.emailLabel' => ['present', 'nullable', 'string', 'max:40'],
            'offices.email' => ['required', 'string', 'email', 'max:160'],

            'newsletter' => ['required', 'array'],
            'newsletter.enabled' => ['required', 'boolean'],
        ]);

        // Rebuild the document key by key rather than storing the request
        // wholesale, so nothing outside the schema ever lands in the row.
        $content = [
            'hero' => [
                'eyebrow' => (string) ($data['hero']['eyebrow'] ?? ''),
                'title' => $data['hero']['title'],
                'image' => (string) ($data['hero']['image'] ?? ''),
            ],
            'inquiry' => [
                'eyebrow' => (string) ($data['inquiry']['eyebrow'] ?? ''),
                'heading' => $data['inquiry']['heading'],
                'blurb' => (string) ($data['inquiry']['blurb'] ?? ''),
                'deskLabel' => (string) ($data['inquiry']['deskLabel'] ?? ''),
                'deskName' => (string) ($data['inquiry']['deskName'] ?? ''),
                'deskPhone' => (string) ($data['inquiry']['deskPhone'] ?? ''),
                'interests' => array_values($data['inquiry']['interests']),
                'submitLabel' => $data['inquiry']['submitLabel'],
                'successHeading' => $data['inquiry']['successHeading'],
                'successBody' => $data['inquiry']['successBody'],
            ],
            'offices' => [
                'eyebrow' => (string) ($data['offices']['eyebrow'] ?? ''),
                'heading' => $data['offices']['heading'],
                'addressLabel' => (string) ($data['offices']['addressLabel'] ?? ''),
                'address' => array_values($data['offices']['address']),
                'contactLabel' => (string) ($data['offices']['contactLabel'] ?? ''),
                'channels' => array_map(
                    fn ($c) => ['label' => $c['label'], 'value' => $c['value']],
                    array_values($data['offices']['channels']),
                ),
                'emailLabel' => (string) ($data['offices']['emailLabel'] ?? ''),
                'email' => $data['offices']['email'],
            ],
            'newsletter' => [
                'enabled' => (bool) $data['newsletter']['enabled'],
            ],
        ];

        $page = ContactPage::current();
        $page->update(['content' => $content]);

        $audit = Audit::log('Updated Contact page copy', 'Contact page');

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Hero backdrop for the Contact page, filed in the shared media library. */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => MediaLibrary::IMAGE_RULES,
            'label' => ['nullable', 'string', 'max:120'],
            'usedBy' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', 'in:photo,portrait,graphic'],
        ]);

        $asset = MediaLibrary::store(
            $request->file('file'),
            $data['label'] ?? '',
            ($data['usedBy'] ?? '') ?: 'Contact page',
            $data['kind'] ?? 'photo',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }
}
