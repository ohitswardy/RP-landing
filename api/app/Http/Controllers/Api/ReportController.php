<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    private const RULES = [
        'title' => ['required', 'string', 'max:500'],
        'category' => ['nullable', 'string', 'max:60'],
        'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        'analyst' => ['required', 'string', 'max:120'],
        'pages' => ['nullable', 'integer', 'min:0', 'max:2000'],
        'summary' => ['nullable', 'string', 'max:2000'],
    ];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            ...self::RULES,
            'file' => ['required', 'file', 'mimetypes:application/pdf', 'max:25600'],
        ]);

        $file = $request->file('file');
        $path = $file->store('reports');

        $report = Report::create([
            'title' => $data['title'],
            'category' => $data['category'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'analyst' => $data['analyst'],
            'pages' => (int) ($data['pages'] ?? 0),
            'summary' => $data['summary'] ?? '',
            'date' => now()->toDateString(),
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'file_path' => $path,
            'file_url' => null,
        ]);

        $audit = Audit::log('Published report', $report->title);

        return response()->json(['item' => $report->load('company')->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            ...self::RULES,
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

        $report->fill([
            'title' => $data['title'],
            'category' => $data['category'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'analyst' => $data['analyst'],
            'pages' => (int) ($data['pages'] ?? 0),
            'summary' => $data['summary'] ?? '',
        ])->save();

        $audit = Audit::log($replaced ? 'Replaced report PDF' : 'Updated report', $report->title);

        return response()->json(['item' => $report->load('company')->toWire(), 'audit' => $audit->toWire()]);
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
