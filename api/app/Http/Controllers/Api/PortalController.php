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
    /** The research catalog as the signed-in client sees it. */
    public function reports(): JsonResponse
    {
        // Most-read ranking off the consumption ledger, under whatever rules
        // the desk set in the CMS Reports module (metric, window, slots).
        $settings = PortalSetting::current();

        return response()->json([
            'reports' => Report::with('company', 'reportType')->orderByDesc('date')->orderByDesc('id')->get()->map->toWire()->values(),
            'companies' => Company::orderBy('name')->get()->map->toWire()->values(),
            'reportTypes' => ReportType::orderBy('name')->get()->map->toWire()->values(),
            'trending' => [
                'metric' => $settings->trending_metric,
                'windowMonths' => (int) $settings->trending_window_months,
                'entries' => $settings->trending_enabled
                    ? Trending::rank([
                        'metric' => $settings->trending_metric,
                        'windowMonths' => (int) $settings->trending_window_months,
                        'limit' => (int) $settings->trending_limit,
                        'minEvents' => (int) $settings->trending_min_events,
                    ])
                    : [],
            ],
        ]);
    }

    /** report id → ISO timestamp the client saved it. */
    public function bookmarks(Request $request): JsonResponse
    {
        $marks = Bookmark::where('user_id', $request->user()->id)
            ->get()
            ->mapWithKeys(fn (Bookmark $b) => [(string) $b->report_id => $b->saved_at->toIso8601String()])
            ->all();

        // (object) so an empty shelf serializes as {} rather than [].
        return response()->json(['marks' => (object) $marks]);
    }

    public function toggleBookmark(Request $request, Report $report): JsonResponse
    {
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
