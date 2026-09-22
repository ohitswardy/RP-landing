<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CareerPost;
use App\Support\Audit;
use App\Support\Html;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CareerController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'dept' => ['required', 'string', 'max:60'],
            'type' => ['required', 'in:Full-time,Contract,Internship'],
            'location' => ['required', 'string', 'max:120'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'body' => ['sometimes', 'nullable', 'string', 'max:200000'],
        ]);

        $career = CareerPost::create([
            ...$data,
            'summary' => (string) ($data['summary'] ?? ''),
            'body' => Html::article($data['body'] ?? null),
            'posted' => now()->toDateString(),
            'status' => 'open',
            'applicants' => 0,
        ]);

        $audit = Audit::log('Opened posting', $career->title);

        return response()->json(['item' => $career->toWire(), 'audit' => $audit->toWire()], 201);
    }

    public function update(Request $request, CareerPost $career): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'dept' => ['sometimes', 'string', 'max:60'],
            'type' => ['sometimes', 'in:Full-time,Contract,Internship'],
            'location' => ['sometimes', 'string', 'max:120'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'body' => ['sometimes', 'nullable', 'string', 'max:200000'],
            'status' => ['sometimes', 'in:open,closed'],
        ]);

        $statusChanged = array_key_exists('status', $data) && $data['status'] !== $career->status;
        if (array_key_exists('summary', $data)) {
            $data['summary'] = (string) $data['summary'];
        }
        if (array_key_exists('body', $data)) {
            $data['body'] = Html::article($data['body']);
        }
        $career->fill($data)->save();

        $audit = Audit::log(
            $statusChanged ? ($career->status === 'open' ? 'Reopened posting' : 'Closed posting') : 'Updated posting',
            $career->title,
        );

        return response()->json(['item' => $career->toWire(), 'audit' => $audit->toWire()]);
    }

    public function destroy(CareerPost $career): JsonResponse
    {
        $title = $career->title;
        $career->delete();
        $audit = Audit::log('Deleted posting', $title);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
