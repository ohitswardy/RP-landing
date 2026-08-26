<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PageBlock;
use App\Support\Audit;
use App\Support\LegalDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PageController extends Controller
{
    /** The module edits the legal documents and nothing else. */
    public function update(Request $request, PageBlock $page): JsonResponse
    {
        if (! in_array($page->page, LegalDefaults::titles(), true)) {
            throw new NotFoundHttpException();
        }

        $data = $request->validate([
            'value' => ['required', 'string', 'max:40000'],
        ]);

        $page->update([
            'value' => $data['value'],
            'updated' => now()->toDateString(),
            'editor' => $request->user()?->name ?? 'Staff',
        ]);

        $audit = Audit::log('Updated legal copy', "{$page->page} / {$page->field}");

        return response()->json(['item' => $page->toWire(), 'audit' => $audit->toWire()]);
    }
}
