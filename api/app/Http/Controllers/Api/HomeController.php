<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HomePage;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /** Site-relative paths only: every landing-page link routes inside the app. */
    private const PATH = ['present', 'nullable', 'string', 'max:200', 'regex:#^/[^\s]*$#'];

    private const IMAGE = ['present', 'nullable', 'string', 'max:500'];

    /** Replace the landing page document. The CMS always sends the full document. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hero' => ['required', 'array'],
            'hero.enabled' => ['required', 'boolean'],
            'hero.eyebrow' => ['present', 'nullable', 'string', 'max:80'],
            'hero.headline' => ['required', 'string', 'max:200'],
            'hero.dek' => ['present', 'nullable', 'string', 'max:400'],
            'hero.image' => self::IMAGE,

            'numbers' => ['required', 'array'],
            'numbers.enabled' => ['required', 'boolean'],
            'numbers.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'numbers.heading' => ['required', 'string', 'max:120'],
            'numbers.intro' => ['present', 'nullable', 'string', 'max:600'],
            'numbers.stats' => ['present', 'array', 'min:1', 'max:6'],
            'numbers.stats.*.value' => ['required', 'integer', 'min:0', 'max:999999'],
            'numbers.stats.*.suffix' => ['present', 'nullable', 'string', 'max:4'],
            'numbers.stats.*.label' => ['required', 'string', 'max:80'],

            'services' => ['required', 'array'],
            'services.enabled' => ['required', 'boolean'],
            'services.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'services.heading' => ['required', 'string', 'max:160'],
            'services.cta' => ['required', 'array'],
            'services.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'services.cta.href' => self::PATH,
            'services.rows' => ['present', 'array', 'min:1', 'max:8'],
            'services.rows.*.title' => ['required', 'string', 'max:80'],
            'services.rows.*.blurb' => ['present', 'nullable', 'string', 'max:160'],
            'services.rows.*.href' => self::PATH,
            'services.rows.*.image' => self::IMAGE,

            'insights' => ['required', 'array'],
            'insights.enabled' => ['required', 'boolean'],
            'insights.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'insights.heading' => ['required', 'string', 'max:120'],
            'insights.intro' => ['present', 'nullable', 'string', 'max:600'],
            'insights.cta' => ['required', 'array'],
            'insights.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'insights.cta.href' => self::PATH,
            'insights.featured' => ['present', 'array', 'max:2'],
            'insights.featured.*.kicker' => ['present', 'nullable', 'string', 'max:60'],
            'insights.featured.*.title' => ['required', 'string', 'max:160'],
            'insights.featured.*.blurb' => ['present', 'nullable', 'string', 'max:400'],
            'insights.featured.*.meta' => ['present', 'nullable', 'string', 'max:60'],
            'insights.featured.*.href' => self::PATH,
            'insights.featured.*.image' => self::IMAGE,
            'insights.rows' => ['present', 'array', 'max:6'],
            'insights.rows.*.kicker' => ['present', 'nullable', 'string', 'max:60'],
            'insights.rows.*.title' => ['required', 'string', 'max:200'],
            'insights.rows.*.meta' => ['present', 'nullable', 'string', 'max:60'],
            'insights.rows.*.href' => self::PATH,

            'culture' => ['required', 'array'],
            'culture.enabled' => ['required', 'boolean'],
            'culture.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'culture.heading' => ['required', 'string', 'max:160'],
            'culture.cta' => ['required', 'array'],
            'culture.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'culture.cta.href' => self::PATH,
            'culture.image' => self::IMAGE,
            'culture.imageAlt' => ['present', 'nullable', 'string', 'max:160'],

            'community' => ['required', 'array'],
            'community.enabled' => ['required', 'boolean'],
            'community.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'community.heading' => ['required', 'string', 'max:160'],
            'community.body' => ['present', 'nullable', 'string', 'max:500'],
            'community.cta' => ['required', 'array'],
            'community.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'community.cta.href' => self::PATH,
            'community.image' => self::IMAGE,
            'community.imageAlt' => ['present', 'nullable', 'string', 'max:160'],

            'quote' => ['required', 'array'],
            'quote.enabled' => ['required', 'boolean'],
            'quote.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'quote.quote' => ['required', 'string', 'max:500'],
            'quote.name' => ['present', 'nullable', 'string', 'max:80'],
            'quote.role' => ['present', 'nullable', 'string', 'max:80'],
            'quote.cta' => ['required', 'array'],
            'quote.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'quote.cta.href' => self::PATH,
            'quote.image' => self::IMAGE,

            'careers' => ['required', 'array'],
            'careers.enabled' => ['required', 'boolean'],
            'careers.eyebrow' => ['present', 'nullable', 'string', 'max:60'],
            'careers.heading' => ['required', 'string', 'max:120'],
            'careers.body' => ['present', 'nullable', 'string', 'max:500'],
            'careers.cta' => ['required', 'array'],
            'careers.cta.label' => ['present', 'nullable', 'string', 'max:60'],
            'careers.cta.href' => self::PATH,
            'careers.image' => self::IMAGE,
            'careers.imageAlt' => ['present', 'nullable', 'string', 'max:160'],
        ], array_fill_keys([
            'services.cta.href.regex', 'services.rows.*.href.regex',
            'insights.cta.href.regex', 'insights.featured.*.href.regex', 'insights.rows.*.href.regex',
            'culture.cta.href.regex', 'community.cta.href.regex', 'quote.cta.href.regex', 'careers.cta.href.regex',
        ], 'Links must be site paths that start with “/”.'));

        $s = fn ($v): string => (string) ($v ?? '');
        $cta = fn (array $c): array => ['label' => $s($c['label'] ?? null), 'href' => $s($c['href'] ?? null)];

        // Rebuild the document key by key rather than storing the request
        // wholesale, so nothing outside the schema ever lands in the row.
        $content = [
            'hero' => [
                'enabled' => (bool) $data['hero']['enabled'],
                'eyebrow' => $s($data['hero']['eyebrow'] ?? null),
                'headline' => $data['hero']['headline'],
                'dek' => $s($data['hero']['dek'] ?? null),
                'image' => $s($data['hero']['image'] ?? null),
            ],
            'numbers' => [
                'enabled' => (bool) $data['numbers']['enabled'],
                'eyebrow' => $s($data['numbers']['eyebrow'] ?? null),
                'heading' => $data['numbers']['heading'],
                'intro' => $s($data['numbers']['intro'] ?? null),
                'stats' => array_map(
                    fn ($x) => ['value' => (int) $x['value'], 'suffix' => $s($x['suffix'] ?? null), 'label' => $x['label']],
                    array_values($data['numbers']['stats']),
                ),
            ],
            'services' => [
                'enabled' => (bool) $data['services']['enabled'],
                'eyebrow' => $s($data['services']['eyebrow'] ?? null),
                'heading' => $data['services']['heading'],
                'cta' => $cta($data['services']['cta']),
                'rows' => array_map(
                    fn ($r) => ['title' => $r['title'], 'blurb' => $s($r['blurb'] ?? null), 'href' => $s($r['href'] ?? null), 'image' => $s($r['image'] ?? null)],
                    array_values($data['services']['rows']),
                ),
            ],
            'insights' => [
                'enabled' => (bool) $data['insights']['enabled'],
                'eyebrow' => $s($data['insights']['eyebrow'] ?? null),
                'heading' => $data['insights']['heading'],
                'intro' => $s($data['insights']['intro'] ?? null),
                'cta' => $cta($data['insights']['cta']),
                'featured' => array_map(
                    fn ($f) => [
                        'kicker' => $s($f['kicker'] ?? null), 'title' => $f['title'], 'blurb' => $s($f['blurb'] ?? null),
                        'meta' => $s($f['meta'] ?? null), 'href' => $s($f['href'] ?? null), 'image' => $s($f['image'] ?? null),
                    ],
                    array_values($data['insights']['featured']),
                ),
                'rows' => array_map(
                    fn ($r) => ['kicker' => $s($r['kicker'] ?? null), 'title' => $r['title'], 'meta' => $s($r['meta'] ?? null), 'href' => $s($r['href'] ?? null)],
                    array_values($data['insights']['rows']),
                ),
            ],
            'culture' => [
                'enabled' => (bool) $data['culture']['enabled'],
                'eyebrow' => $s($data['culture']['eyebrow'] ?? null),
                'heading' => $data['culture']['heading'],
                'cta' => $cta($data['culture']['cta']),
                'image' => $s($data['culture']['image'] ?? null),
                'imageAlt' => $s($data['culture']['imageAlt'] ?? null),
            ],
            'community' => [
                'enabled' => (bool) $data['community']['enabled'],
                'eyebrow' => $s($data['community']['eyebrow'] ?? null),
                'heading' => $data['community']['heading'],
                'body' => $s($data['community']['body'] ?? null),
                'cta' => $cta($data['community']['cta']),
                'image' => $s($data['community']['image'] ?? null),
                'imageAlt' => $s($data['community']['imageAlt'] ?? null),
            ],
            'quote' => [
                'enabled' => (bool) $data['quote']['enabled'],
                'eyebrow' => $s($data['quote']['eyebrow'] ?? null),
                'quote' => $data['quote']['quote'],
                'name' => $s($data['quote']['name'] ?? null),
                'role' => $s($data['quote']['role'] ?? null),
                'cta' => $cta($data['quote']['cta']),
                'image' => $s($data['quote']['image'] ?? null),
            ],
            'careers' => [
                'enabled' => (bool) $data['careers']['enabled'],
                'eyebrow' => $s($data['careers']['eyebrow'] ?? null),
                'heading' => $data['careers']['heading'],
                'body' => $s($data['careers']['body'] ?? null),
                'cta' => $cta($data['careers']['cta']),
                'image' => $s($data['careers']['image'] ?? null),
                'imageAlt' => $s($data['careers']['imageAlt'] ?? null),
            ],
        ];

        $page = HomePage::current();
        $page->update(['content' => $content]);

        $audit = Audit::log('Updated landing page', 'Landing page');

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Landing-page photography, filed in the shared media library. */
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
            ($data['usedBy'] ?? '') ?: 'Landing page',
            $data['kind'] ?? 'photo',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }
}
