<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Client;
use App\Services\Crms\ReportGenerator;
use App\Support\SimpleXlsx;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends CrmsController
{
    /** Generic, Internal, or By Client — always as a workbook download. */
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

        $report = $generator->build($data['type'], $data['from'], $data['to'], $client);
        $this->audit('Generated '.$data['type'].' report', ($client?->name ?? 'all clients')." {$data['from']} → {$data['to']}");

        return SimpleXlsx::downloadSheets($report['filename'], $report['sheets']);
    }
}
