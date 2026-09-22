<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AboutPage;
use App\Models\Article;
use App\Models\CareerPost;
use App\Models\ContactPage;
use App\Models\HomePage;
use App\Models\InsightPage;
use App\Models\PageBlock;
use App\Models\ServiceLine;
use App\Models\ServicePage;
use App\Models\StaffMember;
use App\Models\WatchSymbol;
use App\Support\LegalDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Public read models for the marketing site. No auth: everything here is
 * already on the open web, and only published records are returned.
 */
class SiteContentController extends Controller
{
    /** The public routes the site search can always offer, whatever the CMS holds. */
    public const PAGES = [
        ['title' => 'Home', 'path' => '/'],
        ['title' => 'About', 'path' => '/about'],
        ['title' => 'Services', 'path' => '/services'],
        ['title' => 'Insights', 'path' => '/insights'],
        ['title' => 'Careers', 'path' => '/careers'],
        ['title' => 'Contact', 'path' => '/contact'],
        ['title' => 'Client login', 'path' => '/login'],
    ];

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

    /** The journal page: its composition plus every published note (summaries, no bodies). */
    public function insights(): JsonResponse
    {
        return response()->json([
            'page' => InsightPage::current()->toWire(),
            'articles' => Article::published()
                ->orderByDesc('date')->orderByDesc('id')
                ->limit(200)
                ->get()
                ->map(fn (Article $a) => $a->toSummary())
                ->values(),
        ]);
    }

    /**
     * One published note in full, with three related published notes:
     * same tag first, then the newest of the rest. A draft or unknown
     * slug is a 404, so nothing under review leaks by URL.
     */
    public function insight(string $slug): JsonResponse
    {
        $article = Article::published()->where('slug', $slug)->first();
        abort_unless($article, 404);

        $related = Article::published()
            ->where('id', '!=', $article->id)
            ->where('tag', $article->tag)
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(3)
            ->get();
        if ($related->count() < 3) {
            $more = Article::published()
                ->where('id', '!=', $article->id)
                ->whereNotIn('id', $related->pluck('id'))
                ->orderByDesc('date')->orderByDesc('id')
                ->limit(3 - $related->count())
                ->get();
            $related = $related->concat($more);
        }

        return response()->json([
            'article' => [
                ...$article->toSummary(),
                'body' => (string) $article->body,
            ],
            'related' => $related->map(fn (Article $a) => $a->toSummary())->values(),
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

    /** The Contact page: hero caption, inquiry panel, office ledger, social links. */
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

    /** The market ribbon's symbol list, in CMS order; pinned names first. */
    public function watchlist(): JsonResponse
    {
        return response()->json([
            'symbols' => WatchSymbol::orderByDesc('pinned')->orderBy('position')->orderBy('id')
                ->get()->map->toWire()->values(),
        ]);
    }

    /** Open postings for the public careers page, newest first. */
    public function careers(): JsonResponse
    {
        return response()->json([
            'careers' => CareerPost::open()
                ->orderByDesc('posted')->orderByDesc('id')
                ->get()->map->toWire()->values(),
        ]);
    }

    /**
     * The index behind the site's search modal: visible people, live
     * service lines, published notes and the static page list. Cached
     * for a minute so the modal can hit it freely.
     */
    public function search(): JsonResponse
    {
        $index = Cache::remember('content.search', 60, fn () => [
            'people' => StaffMember::where('visible', true)
                ->orderBy('position')->orderBy('id')
                ->get()
                ->map(fn (StaffMember $p) => [
                    'id' => (string) $p->id,
                    'name' => $p->name,
                    'role' => array_values($p->roles ?? [])[0] ?? '',
                    'team' => (string) $p->team,
                    'sectors' => array_values($p->sectors ?? []),
                    'anchor' => '/about#'.Str::slug($p->name),
                ])
                ->values()
                ->all(),
            'services' => ServiceLine::where('live', true)
                ->orderBy('position')->orderBy('id')
                ->get()
                ->map(fn (ServiceLine $s) => [
                    'id' => (string) $s->id,
                    'title' => $s->title,
                    'slug' => $s->slug,
                    'summary' => (string) $s->dek,
                    'path' => '/services/'.$s->slug,
                ])
                ->values()
                ->all(),
            'insights' => Article::published()
                ->orderByDesc('date')->orderByDesc('id')
                ->limit(200)
                ->get()
                ->map(fn (Article $a) => [
                    'id' => (string) $a->id,
                    'title' => $a->title,
                    'slug' => (string) $a->slug,
                    'tag' => $a->tag,
                    'date' => $a->date->format('Y-m-d'),
                    'path' => '/insights/'.$a->slug,
                ])
                ->values()
                ->all(),
            'pages' => self::PAGES,
            'generatedAt' => now()->toIso8601String(),
        ]);

        return response()->json($index);
    }
}
