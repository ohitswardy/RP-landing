<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Interaction;
use App\Models\Crms\ReportTemplate;
use App\Services\Crms\BundledTemplates;
use App\Services\Crms\LayoutRenderer;
use App\Services\Crms\ReportSources;
use App\Support\XlsxTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Imported report templates (Form builder → Report template): store a
 * client's own Excel workbook plus the column → data-source map, preview
 * the map against real interactions, and hand the original back.
 */
class ReportLayoutController extends CrmsController
{
    private const MAX_KB = 10240;

    private function layoutRules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:120'],
            'sheet' => ['required', 'string', 'max:31'],
            'headerRow' => ['required', 'integer', 'min:1', 'max:1000'],
            'dataStart' => ['required', 'integer', 'min:2', 'max:1001', 'gt:headerRow'],
            'scope' => ['nullable', Rule::in(ReportSources::SCOPES)],
            'columns' => ['present', 'array', 'max:200'],
            'columns.*.index' => ['required', 'integer', 'min:0', 'max:16383', 'distinct'],
            'columns.*.header' => ['nullable', 'string', 'max:255'],
            'columns.*.source' => ['required', 'string', 'max:120'],
            'columns.*.separator' => ['nullable', 'string', 'max:5'],
            'columns.*.format' => ['nullable', 'string', 'max:40'],
            'columns.*.text' => ['nullable', 'string', 'max:500'],
            'cells' => ['nullable', 'array', 'max:40'],
            'cells.*.ref' => ['required', 'string', 'regex:/^[A-Z]{1,3}[1-9][0-9]{0,6}$/'],
            'cells.*.source' => ['required', 'string', 'max:120'],
            'cells.*.text' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** POST /crms/report-templates/layout (multipart: clientId, file?, layout JSON). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'clientId' => ['required', 'integer', Rule::exists('crms.client', 'id')],
            'file' => ['nullable', 'file', 'max:'.self::MAX_KB, 'extensions:xlsx'],
            'layout' => ['required', 'string', 'max:400000'],
        ]);
        $layout = json_decode($data['layout'], true);
        if (! is_array($layout)) {
            return response()->json(['message' => 'The layout could not be read.'], 422);
        }
        $layout = Validator::make($layout, $this->layoutRules())->validate();
        foreach ([...$layout['columns'], ...($layout['cells'] ?? [])] as $c) {
            if (! ReportSources::isValid($c['source'])) {
                return response()->json(['message' => 'Unknown data source "'.$c['source'].'".'], 422);
            }
        }

        $client = Client::findOrFail($data['clientId']);
        $existing = ReportTemplate::where('client_id', $client->id)->first();
        $file = $request->file('file');
        if (! $file && ! $existing?->hasLayout()) {
            return response()->json(['message' => 'Choose the Excel template to import.'], 422);
        }

        // The workbook must be a real .xlsx holding the sheet and header row the map names.
        $disk = Storage::disk('local');
        try {
            $book = XlsxTemplate::open($file ? $file->getRealPath() : $disk->path($existing->layout_file));
            $sheets = array_keys($book->sheets());
            if (! in_array($layout['sheet'], $sheets, true)) {
                return response()->json(['message' => 'The workbook has no sheet named "'.$layout['sheet'].'".'], 422);
            }
            $headers = $book->rowText($layout['sheet'], (int) $layout['headerRow']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        if ($headers === []) {
            return response()->json(['message' => 'Row '.$layout['headerRow'].' of "'.$layout['sheet'].'" has no header cells.'], 422);
        }

        $columns = [];
        foreach ($layout['columns'] as $c) {
            $columns[] = [
                'index' => (int) $c['index'],
                'header' => trim((string) ($c['header'] ?? '')) !== '' ? trim((string) $c['header']) : ($headers[(int) $c['index']] ?? ''),
                'source' => $c['source'],
                'separator' => $c['separator'] ?? ', ',
                'format' => isset($c['format']) && $c['format'] !== '' ? $c['format'] : null,
                'text' => $c['source'] === 'const' ? (string) ($c['text'] ?? '') : null,
            ];
        }
        usort($columns, fn ($a, $b) => $a['index'] <=> $b['index']);
        $cells = array_values(array_map(fn ($c) => ['ref' => strtoupper($c['ref']), 'source' => $c['source'], 'text' => $c['source'] === 'const' ? (string) ($c['text'] ?? '') : null], $layout['cells'] ?? []));

        $stored = $existing?->layout_file;
        if ($file) {
            $stored = $file->storeAs(ReportTemplate::LAYOUT_DIR, 'client-'.$client->id.'-'.now()->format('YmdHis').'.xlsx', 'local');
            if ($existing?->layout_file && $existing->layout_file !== $stored) {
                $disk->delete($existing->layout_file);
            }
        }

        $template = ReportTemplate::updateOrCreate(['client_id' => $client->id], [
            'code' => 'custom',
            'is_active' => true,
            'layout' => [
                'title' => trim((string) ($layout['title'] ?? '')) ?: null,
                'sheet' => $layout['sheet'],
                'sheets' => $sheets,
                'headerRow' => (int) $layout['headerRow'],
                'dataStart' => (int) $layout['dataStart'],
                'scope' => $layout['scope'] ?? 'client',
                'columns' => $columns,
                'cells' => $cells,
            ],
            'layout_file' => $stored,
            'layout_name' => $file ? $file->getClientOriginalName() : $existing->layout_name,
            'layout_imported_at' => now(),
        ]);

        return $this->item(
            $template->load('client')->toWire(),
            $this->audit($existing ? 'Updated imported report template' : 'Imported report template', $client->name.' · '.$template->layout_name),
            $existing ? 200 : 201,
        );
    }

    /** POST /crms/report-templates/layout/preview — the map against the latest real rows. */
    public function preview(Request $request, ReportSources $sources, LayoutRenderer $renderer): JsonResponse
    {
        $data = $request->validate([
            'clientId' => ['required', 'integer'],
            'scope' => ['nullable', Rule::in(ReportSources::SCOPES)],
            'columns' => ['present', 'array', 'max:200'],
            'columns.*.index' => ['required', 'integer', 'min:0'],
            'columns.*.source' => ['required', 'string', 'max:120'],
            'columns.*.separator' => ['nullable', 'string', 'max:5'],
            'columns.*.format' => ['nullable', 'string', 'max:40'],
            'columns.*.text' => ['nullable', 'string', 'max:500'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);
        $client = Client::find($data['clientId']);
        $scope = $data['scope'] ?? 'client';

        $query = Interaction::with(['client', 'type'])
            ->when($client && $scope === 'client', fn ($q) => $q->where('client_id', $client->id))
            ->when($scope === 'foreign', fn ($q) => $q->whereHas('client', fn ($c) => $c->where('client_type', 'Foreign')));
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('interaction_date')->orderByDesc('id')->limit($data['limit'] ?? 6)->get();

        $sources->begin($client, (string) ($request->user()?->name ?? ''), '', '');
        $out = [];
        foreach ($rows as $i) {
            $out[] = array_map(fn ($c) => $renderer->display($c, $i), $data['columns']);
        }

        return response()->json(['rows' => $out, 'total' => $total]);
    }

    /** GET /crms/report-templates/bundled/{key}/file — a bundled client template as it ships. */
    public function bundled(string $key): BinaryFileResponse
    {
        abort_unless(BundledTemplates::isKey($key) && is_file(BundledTemplates::path($key)), 404, 'No such bundled template.');

        return response()->download(BundledTemplates::path($key), BundledTemplates::FILES[$key], [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** GET /crms/report-templates/{template}/layout/file — the workbook as imported. */
    public function download(ReportTemplate $template): BinaryFileResponse
    {
        $disk = Storage::disk('local');
        abort_unless($template->hasLayout() && $disk->exists($template->layout_file), 404, 'This client has no imported template.');

        return response()->download($disk->path($template->layout_file), $template->layout_name ?: 'template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
