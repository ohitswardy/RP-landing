<?php

namespace App\Support;

use App\Models\MediaAsset;
use Illuminate\Http\UploadedFile;

/**
 * One place where an uploaded site image lands on disk and gets filed in
 * the media library. Modules own their own upload routes because their
 * permissions differ, but they all come through here.
 */
class MediaLibrary
{
    /** Validation rules every image upload shares. */
    public const IMAGE_RULES = ['required', 'file', 'mimes:jpg,jpeg,png,webp,avif', 'max:8192'];

    public static function store(UploadedFile $file, string $label, string $usedBy, string $kind = 'photo'): MediaAsset
    {
        $stored = $file->store('site', 'public');

        return MediaAsset::create([
            // Served back through the API so the path works in dev and in production.
            'path' => '/api/media/'.$stored,
            'label' => $label ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'kind' => $kind,
            'used_by' => $usedBy,
        ]);
    }
}
