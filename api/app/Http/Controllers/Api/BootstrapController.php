<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AboutPage;
use App\Models\Article;
use App\Models\AuditEntry;
use App\Models\CareerPost;
use App\Models\Company;
use App\Models\ContactPage;
use App\Models\InsightPage;
use App\Models\MediaAsset;
use App\Models\NewsletterIssue;
use App\Models\PageBlock;
use App\Models\PortalSetting;
use App\Models\Report;
use App\Models\ReportType;
use App\Models\ServiceLine;
use App\Models\ServicePage;
use App\Models\StaffMember;
use App\Models\Subscriber;
use App\Models\WatchSymbol;
use App\Support\LegalDefaults;
use Illuminate\Http\JsonResponse;

class BootstrapController extends Controller
{
    /** Everything the CMS workspace needs in one round-trip. */
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'articles' => Article::orderByDesc('date')->orderByDesc('id')->get()->map->toWire()->values(),
            'reports' => Report::with('company', 'reportType')->orderByDesc('date')->orderByDesc('id')->get()->map->toWire()->values(),
            'companies' => Company::orderBy('name')->get()->map->toWire()->values(),
            // Editable report-type registry (Results, Rating Change, …).
            'reportTypes' => ReportType::orderBy('name')->get()->map->toWire()->values(),
            // How the portal dashboard ranks Trending Content (Reports module).
            'trendingRules' => PortalSetting::current()->trendingToWire(),
            'people' => StaffMember::orderBy('position')->orderBy('id')->get()->map->toWire()->values(),
            'services' => ServiceLine::orderBy('position')->orderBy('id')->get()->map->toWire()->values(),
            'servicePage' => ServicePage::current()->toWire(),
            'aboutPage' => AboutPage::current()->toWire(),
            'contactPage' => ContactPage::current()->toWire(),
            'insightsPage' => InsightPage::current()->toWire(),
            'careers' => CareerPost::orderByDesc('posted')->orderByDesc('id')->get()->map->toWire()->values(),
            'watchlist' => WatchSymbol::orderBy('position')->orderBy('id')->get()->map->toWire()->values(),
            'newsletters' => NewsletterIssue::orderByDesc('date')->orderByDesc('id')->get()->map->toWire()->values(),
            'subscribers' => Subscriber::orderByDesc('joined')->orderByDesc('id')->get()->map->toWire()->values(),
            // Only the legal documents are editable copy — see the Legal module.
            'pages' => PageBlock::whereIn('page', LegalDefaults::titles())
                ->orderBy('page')->orderBy('position')->orderBy('id')
                ->get()->map->toWire()->values(),
            'media' => MediaAsset::orderBy('id')->get()->map->toWire()->values(),
            'audit' => AuditEntry::orderByDesc('at')->orderByDesc('id')->limit(60)->get()->map->toWire()->values(),
        ]);
    }
}
