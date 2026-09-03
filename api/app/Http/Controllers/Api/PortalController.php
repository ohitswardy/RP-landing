<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bookmark;
use App\Models\Company;
use App\Models\PortalSetting;
use App\Models\Report;
use App\Models\ReportType;
use App\Support\Trending;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    /** The research catalog as the signed-in client sees it. A client
        provisioned with preferred sectors or preferred analysts sees only the
        research on that mandate — here, and in everything derived from it:
        the covered-company registry, the trending ladder, and their shelf. */
    public function reports(Request $request): JsonResponse
    {
        // Most-read ranking off the consumption ledger, under whatever rules
        // the desk set in the CMS Reports module (metric, window, slots).
        $settings = PortalSetting::current();
        $client = $request->user();

        $reports = Report::with('company', 'reportType')
            ->visibleTo($client)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();

        // Restricted clients get the registry pruned to the names they can
        // actually read, so no company row sits at zero reports.
        $companies = Company::orderBy('name')->get();
        if ($client?->hasCoverageFilter()) {
            $covered = $reports->pluck('company_id')->filter()->unique()->all();
            $companies = $companies->whereIn('id', $covered)->values();
        }

        $trending = $settings->trending_enabled
            ? Trending::rank([
                'metric' => $settings->trending_metric,
                'windowMonths' => (int) $settings->trending_window_months,
                'limit' => (int) $settings->trending_limit,
                'minEvents' => (int) $settings->trending_min_events,
            ])
            : [];

        if ($client?->hasCoverageFilter()) {
            $ids = $reports->pluck('id')->map(fn ($id) => (string) $id)->all();
            $trending = array_values(array_filter(
                $trending,
                fn ($entry) => in_array((string) ($entry['reportId'] ?? ''), $ids, true),
            ));
        }

        return response()->json([
            'reports' => $reports->map->toWire()->values(),
            'companies' => $companies->map->toWire()->values(),
            'reportTypes' => ReportType::orderBy('name')->get()->map->toWire()->values(),
            'trending' => [
                'metric' => $settings->trending_metric,
                'windowMonths' => (int) $settings->trending_window_months,
                'entries' => $trending,
            ],
        ]);
    }

    /** report id → ISO timestamp the client saved it. */
    public function bookmarks(Request $request): JsonResponse
    {
        $marks = Bookmark::where('user_id', $request->user()->id)
            ->whereHas('report', fn ($q) => $q->visibleTo($request->user()))
            ->get()
            ->mapWithKeys(fn (Bookmark $b) => [(string) $b->report_id => $b->saved_at->toIso8601String()])
            ->all();

        // (object) so an empty shelf serializes as {} rather than [].
        return response()->json(['marks' => (object) $marks]);
    }

    public function toggleBookmark(Request $request, Report $report): JsonResponse
    {
        if (! $report->isVisibleTo($request->user())) {
            return response()->json(['message' => 'That report is outside your coverage.'], 403);
        }

        $existing = Bookmark::where('user_id', $request->user()->id)
            ->where('report_id', $report->id)
            ->first();

        if ($existing) {
            $existing->delete();

            return response()->json(['saved' => false, 'savedAt' => null]);
        }

        $mark = Bookmark::create([
            'user_id' => $request->user()->id,
            'report_id' => $report->id,
            'saved_at' => now(),
        ]);

        return response()->json(['saved' => true, 'savedAt' => $mark->saved_at->toIso8601String()]);
    }

    public function removeBookmark(Request $request, Report $report): JsonResponse
    {
        Bookmark::where('user_id', $request->user()->id)
            ->where('report_id', $report->id)
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function clearBookmarks(Request $request): JsonResponse
    {
        Bookmark::where('user_id', $request->user()->id)->delete();

        return response()->json(['ok' => true]);
    }
}
