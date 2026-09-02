<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalSetting;
use App\Models\Report;
use App\Support\Audit;
use App\Support\Trending;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    /** Buy / Hold / Sell. A report may also carry no rating at all. */
    public const RATINGS = ['Buy', 'Hold', 'Sell'];

    /** Fields shared by store and update. Everything but title, analyst and
        the publication date is optional — macro research carries no company,
        no rating, and often no sector. */
    private static function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:500'],
            'category' => ['nullable', 'string', 'max:60'],
            'report_type_id' => ['nullable', 'integer', 'exists:report_types,id'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'analyst' => ['required', 'string', 'max:120'],
            'rating' => ['nullable', Rule::in(self::RATINGS)],
            'date' => ['required', 'date'],
            'pages' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'summary' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** The columns a store or update writes, normalised from validated input. */
    private static function attributes(array $data): array
    {
        return [
            'title' => $data['title'],
            'category' => $data['category'] ?? null,
            'report_type_id' => $data['report_type_id'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'analyst' => $data['analyst'],
            'rating' => $data['rating'] ?? null,
            'date' => Carbon::parse($data['date'])->toDateString(),
            'pages' => (int) ($data['pages'] ?? 0),
            'summary' => $data['summary'] ?? '',
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            ...self::rules(),
            'file' => ['required', 'file', 'mimetypes:application/pdf', 'max:25600'],
        ]);

        $file = $request->file('file');
        $path = $file->store('reports');

        $report = Report::create([
            ...self::attributes($data),
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'file_path' => $path,
            'file_url' => null,
        ]);

        $audit = Audit::log('Published report', $report->title);

        return response()->json(['item' => $report->load('company', 'reportType')->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            ...self::rules(),
            'file' => ['nullable', 'file', 'mimetypes:application/pdf', 'max:25600'],
        ]);

        $replaced = false;
        if ($file = $request->file('file')) {
            if ($report->file_path) {
                Storage::delete($report->file_path);
            }
            $report->file_path = $file->store('reports');
            $report->file_name = $file->getClientOriginalName();
            $report->file_size = $file->getSize();
            $report->file_url = null;
            $replaced = true;
        }

        $report->fill(self::attributes($data))->save();

        $audit = Audit::log($replaced ? 'Replaced report PDF' : 'Updated report', $report->title);

        return response()->json(['item' => $report->load('company', 'reportType')->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Ranking-rule fields shared by the update and preview endpoints. */
    private static function trendingRules(): array
    {
        return [
            'metric' => ['required', Rule::in(Trending::METRICS)],
            'windowMonths' => ['required', 'integer', 'min:0', 'max:24'],
            'limit' => ['required', 'integer', 'min:1', 'max:6'],
            'minEvents' => ['required', 'integer', 'min:1', 'max:10000'],
        ];
    }

    /** One line for the audit trail — "Top 3 · views · trailing 3 months". */
    private static function describeTrending(PortalSetting $s): string
    {
        $window = $s->trending_window_months > 0 ? "trailing {$s->trending_window_months} mo" : 'all time';
        $min = $s->trending_min_events > 1 ? " · {$s->trending_min_events}+ to qualify" : '';

        return "Top {$s->trending_limit} · {$s->trending_metric} · {$window}{$min}"
            .($s->trending_enabled ? '' : ' · hidden');
    }

    /** Rewrite how the portal dashboard ranks Trending Content. */
    public function updateTrending(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            ...self::trendingRules(),
        ]);

        $settings = PortalSetting::current();
        $settings->fill([
            'trending_enabled' => $data['enabled'],
            'trending_metric' => $data['metric'],
            'trending_window_months' => $data['windowMonths'],
            'trending_limit' => $data['limit'],
            'trending_min_events' => $data['minEvents'],
        ])->save();

        $audit = Audit::log('Updated trending rules', self::describeTrending($settings));

        return response()->json(['item' => $settings->trendingToWire(), 'audit' => $audit->toWire()]);
    }

    /** Dry-run a rule set against the live ledger — what would rank right now. */
    public function previewTrending(Request $request): JsonResponse
    {
        $data = $request->validate(self::trendingRules());

        return response()->json(['entries' => Trending::rank($data)]);
    }

    /** Make this report the portal's Spotlight showcase (or clear it). */
    public function spotlight(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate(['spotlight' => ['required', 'boolean']]);

        if ($data['spotlight']) {
            // Single showcase slot — flagging one report unflags the rest.
            Report::where('spotlight', true)->where('id', '!=', $report->id)->update(['spotlight' => false]);
        }
        $report->spotlight = $data['spotlight'];
        $report->save();

        $audit = Audit::log($report->spotlight ? 'Spotlighted report' : 'Cleared report spotlight', $report->title);

        return response()->json(['item' => $report->load('company', 'reportType')->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(Report $report): JsonResponse
    {
        if ($report->file_path) {
            Storage::delete($report->file_path);
        }
        $title = $report->title;
        $report->delete();
        $audit = Audit::log('Deleted report', $title);

        return response()->json(['audit' => $audit->toWire()]);
    }

    /** Stream the stored PDF to authenticated staff or clients. */
    public function file(Report $report): Response
    {
        if (! $report->file_path || ! Storage::exists($report->file_path)) {
            return response()->json(['message' => 'This report has no stored PDF.'], 404);
        }

        return Storage::response($report->file_path, $report->file_name, [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
