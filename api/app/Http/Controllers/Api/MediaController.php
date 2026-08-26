<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
}
