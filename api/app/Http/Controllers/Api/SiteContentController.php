<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AboutPage;
use App\Models\Article;
use App\Models\ContactPage;
use App\Models\HomePage;
use App\Models\InsightPage;
use App\Models\PageBlock;
use App\Models\ServiceLine;
use App\Models\ServicePage;
use App\Models\StaffMember;
use App\Support\LegalDefaults;
use Illuminate\Http\JsonResponse;

/**
 * Public read models for the marketing site. No auth: everything here is
 * already on the open web, and only published records are returned.
 */
class SiteContentController extends Controller
{
    /** The landing page: every section's copy and photography, in page order. */
    public function home(): JsonResponse
    {
        return response()->json(['copy' => HomePage::current()->toWire()]);
    }

    /**
     * The photography behind the navbar's mega-menu panels. Each entry is
     * the hero image of the page that menu opens onto, so replacing a hero
     * in the CMS re-dresses its menu with it. Served on its own so the
     * navbar — which renders on every public page — does not have to pull
     * four whole content documents for four filenames.
     */
    public function nav(): JsonResponse
    {
        $insights = InsightPage::current()->toWire();
        $about = AboutPage::current()->toWire();
        $contact = ContactPage::current()->toWire();

        return response()->json([
            'media' => [
                'services' => (string) (ServicePage::current()->toWire()['heroImage'] ?? ''),
                'insights' => (string) ($insights['hero']['image'] ?? ''),
                'about' => (string) ($about['hero']['image'] ?? ''),
                'contact' => (string) ($contact['hero']['image'] ?? ''),
            ],
        ]);
    }

    public function services(): JsonResponse
    {
        return response()->json([
            'page' => ServicePage::current()->toWire(),
            'services' => ServiceLine::where('live', true)
                ->orderBy('position')->orderBy('id')
                ->get()->map->toWire()->values(),
        ]);
    }

    /** The journal page: its composition plus every published note. */
    public function insights(): JsonResponse
    {
        return response()->json([
            'page' => InsightPage::current()->toWire(),
            'articles' => Article::where('status', 'published')
                ->orderByDesc('date')->orderByDesc('id')
                ->limit(200)
                ->get()
                ->map(fn (Article $a) => [
                    'id' => (string) $a->id,
                    'tag' => $a->tag,
                    'title' => $a->title,
                    'author' => $a->author,
                    'date' => $a->date->format('Y-m-d'),
                    'excerpt' => $a->excerpt,
                    'featured' => (bool) $a->featured,
                ])
                ->values(),
        ]);
    }

    /** Everything the About page needs in one round-trip: copy + roster. */
    public function about(): JsonResponse
    {
        return response()->json([
            'copy' => AboutPage::current()->toWire(),
            'people' => StaffMember::where('visible', true)
                ->orderBy('position')->orderBy('id')
                ->get()->map->toWire()->values(),
        ]);
    }

    /**
     * The legal documents behind the footer links and every login portal.
     * Each is one body of text; `## ` heading lines open its clauses.
     */
    public function legal(): JsonResponse
    {
        $blocks = PageBlock::whereIn('page', LegalDefaults::titles())
            ->orderBy('position')->orderBy('id')
            ->get()->groupBy('page');

        $documents = [];

        foreach (LegalDefaults::keys() as $title => $key) {
            $rows = $blocks->get($title, collect());

            $documents[] = [
                'key' => $key,
                'title' => $title,
                'effective' => $rows->firstWhere('field', LegalDefaults::EFFECTIVE)?->value ?? '',
                'body' => $rows->firstWhere('field', LegalDefaults::DOCUMENT)?->value ?? '',
            ];
        }

        return response()->json(['documents' => $documents]);
    }

    /** The Contact page: hero caption, inquiry panel, and office ledger. */
    public function contact(): JsonResponse
    {
        return response()->json(['copy' => ContactPage::current()->toWire()]);
    }

    public function people(): JsonResponse
    {
        return response()->json([
            'people' => StaffMember::where('visible', true)
                ->orderBy('position')->orderBy('id')
                ->get()->map->toWire()->values(),
        ]);
    }
}
