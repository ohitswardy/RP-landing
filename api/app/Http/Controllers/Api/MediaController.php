<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Support\Audit;
use App\Support\MediaLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    /**
     * Serve an uploaded site image. Public by design — these are the same
     * photos the marketing pages render — but scoped to the uploads folder
     * so the route cannot be walked into the rest of the disk.
     */
    public function show(string $path): Response
    {
        abort_unless(Str::startsWith($path, 'site/') && ! Str::contains($path, '..'), 404);

        $disk = Storage::disk('public');
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    /* ── Media library module (media.manage) ─────────────────── */

    /** The whole library, same wire shape the bootstrap's `media` carries. */
    public function index(): JsonResponse
    {
        return response()->json([
            'items' => MediaAsset::orderByDesc('id')->get()->map->toWire()->values(),
        ]);
    }

    /** Upload straight into the library, unattached to any module. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => MediaLibrary::IMAGE_RULES,
            'label' => ['nullable', 'string', 'max:120'],
            'usedBy' => ['nullable', 'string', 'max:120'],
            'kind' => ['nullable', 'in:photo,portrait,graphic'],
        ]);

        $asset = MediaLibrary::store(
            $request->file('file'),
            $data['label'] ?? '',
            ($data['usedBy'] ?? '') ?: 'Media library',
            $data['kind'] ?? 'photo',
        );

        $audit = Audit::log('Uploaded image', $asset->label);

        return response()->json(['item' => $asset->toWire(), 'audit' => $audit->toWire()], 201);
    }

    /**
     * Delete the file and its row. Refused while any content document still
     * points at the path, naming what does, so nothing on the site 404s.
     */
    public function destroy(MediaAsset $asset): JsonResponse
    {
        $references = MediaLibrary::references($asset->path);
        if ($references !== []) {
            return response()->json([
                'message' => 'This image is still in use. Replace it there first.',
                'references' => $references,
            ], 409);
        }

        MediaLibrary::deleteFile($asset);
        $label = $asset->label;
        $asset->delete();
        $audit = Audit::log('Deleted image', $label);

        return response()->json(['audit' => $audit->toWire()]);
    }
}
