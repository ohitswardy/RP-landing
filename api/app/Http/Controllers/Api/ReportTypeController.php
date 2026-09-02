<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReportType;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The editable registry of report types (Results, Rating Change, …). */
class ReportTypeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('report_types', 'name')],
        ]);

        $type = ReportType::create($data);
        $audit = Audit::log('Added report type', $type->name);

        return response()->json(['item' => $type->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, ReportType $reportType): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('report_types', 'name')->ignore($reportType->id)],
        ]);

        $was = $reportType->name;
        $reportType->fill($data)->save();
        $audit = Audit::log('Renamed report type', $was === $reportType->name ? $was : "{$was} → {$reportType->name}");

        return response()->json(['item' => $reportType->toWire(), 'audit' => $audit->toWire()]);
    }

    /** Reports filed under the type are kept and unclassified (FK nulls on delete). */
    public function destroy(ReportType $reportType): JsonResponse
    {
        $name = $reportType->name;
        $reportType->delete();
        $audit = Audit::log('Removed report type', $name);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
