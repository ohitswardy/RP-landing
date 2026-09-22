<?php

namespace App\Support;

use App\Models\MediaAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * One place where an uploaded site image lands on disk and gets filed in
 * the media library. Modules own their own upload routes because their
 * permissions differ, but they all come through here.
 */
class MediaLibrary
{
    /** Validation rules every image upload shares. */
    public const IMAGE_RULES = ['required', 'file', 'mimes:jpg,jpeg,png,webp,avif', 'max:8192'];

    /** The URL prefix every library path carries; strip it to get the disk path. */
    public const URL_PREFIX = '/api/media/';

    public static function store(UploadedFile $file, string $label, string $usedBy, string $kind = 'photo'): MediaAsset
    {
        $stored = $file->store('site', 'public');

        return MediaAsset::create([
            // Served back through the API so the path works in dev and in production.
            'path' => self::URL_PREFIX.$stored,
            'label' => $label ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'kind' => $kind,
            'used_by' => $usedBy,
        ]);
    }

    /** The path on the public disk behind a library URL, or null when it is not an upload. */
    public static function diskPath(string $path): ?string
    {
        if (! Str::startsWith($path, self::URL_PREFIX.'site/') || Str::contains($path, '..')) {
            return null;
        }

        return substr($path, strlen(self::URL_PREFIX));
    }

    /**
     * Every content record that still points at this asset, as human labels
     * ("Landing page", "Service line: Research Advisory"). Best effort: a
     * string search over the page documents, the roster, the service lines
     * and the journal, so the desk never deletes a photo that is on the site.
     *
     * @return array<int, string>
     */
    public static function references(string $path): array
    {
        // Uploads get hashed file names, so the basename alone identifies one;
        // searching for it also survives the `\/` slash escaping inside JSON
        // document columns, which a full-path search would miss.
        $needle = basename(self::diskPath($path) ?? $path);
        if ($needle === '' || $needle === '.' || $needle === '/') {
            return [];
        }
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $needle).'%';

        $found = [];
        $scan = function (string $table, array $columns, string $label, ?string $nameColumn = null) use (&$found, $like) {
            if (! Schema::hasTable($table)) {
                return;
            }
            $query = DB::table($table)->where(function ($q) use ($columns, $like) {
                foreach ($columns as $column) {
                    $q->orWhere($column, 'like', $like);
                }
            });
            foreach ($query->get($nameColumn ? ['id', $nameColumn] : ['id']) as $row) {
                $found[] = $nameColumn ? $label.': '.$row->{$nameColumn} : $label;
            }
        };

        $scan('home_pages', ['content'], 'Landing page');
        $scan('about_pages', ['content'], 'About page');
        $scan('contact_pages', ['content'], 'Contact page');
        $scan('insight_pages', ['content'], 'Insights page');
        $scan('service_pages', ['hero_image'], 'Services landing page');
        $scan('service_lines', ['img', 'hero_images'], 'Service line', 'title');
        $scan('staff_members', ['img'], 'Person', 'name');
        $scan('articles', ['body'], 'Insight note', 'title');
        $scan('career_posts', ['body'], 'Career posting', 'title');
        $scan('page_blocks', ['value'], 'Page', 'page');

        return array_values(array_unique($found));
    }

    /** Remove the file behind an asset; a path outside the uploads folder is left alone. */
    public static function deleteFile(MediaAsset $asset): void
    {
        $disk = self::diskPath($asset->path);
        if ($disk !== null && Storage::disk('public')->exists($disk)) {
            Storage::disk('public')->delete($disk);
        }
    }
}
