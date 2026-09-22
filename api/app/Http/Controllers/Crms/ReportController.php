<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Client;
use App\Services\Crms\ReportGenerator;
use App\Support\SimpleXlsx;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends CrmsController
{
    /** Generic, Internal, By Client (a built-in layout or the client's imported Excel template), or the Jefferies bulk upload — always as a workbook download. */
    public function generate(Request $request, ReportGenerator $generator): Response
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(ReportGenerator::TYPES)],
            'clientId' => ['required_if:type,client', 'nullable', 'integer'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $client = isset($data['clientId']) ? Client::find($data['clientId']) : null;
        if ($data['type'] === 'client' && ! $client) {
            return response()->json(['message' => 'Pick the client the report is for.'], 422);
        }

        try {
            $report = $generator->build($data['type'], $data['from'], $data['to'], $client, (string) ($request->user()?->name ?? 'Regis Partners'));
        } catch (RuntimeException $e) {
            // An imported template whose workbook is missing or malformed: say so rather than 500.
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $this->audit('Generated '.$data['type'].' report', ($client?->name ?? 'all clients')." {$data['from']} → {$data['to']}");

        // An imported Excel template is filled in place and streamed as-is; everything else is written by SimpleXlsx.
        if (isset($report['path'])) {
            return response()
                ->download($report['path'], $report['filename'], ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
                ->deleteFileAfterSend(true);
        }

        return SimpleXlsx::downloadSheets($report['filename'], $report['sheets']);
    }
}
