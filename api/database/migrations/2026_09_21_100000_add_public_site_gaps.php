<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * The public-site gaps: readable insight notes (slug + body), a public
 * newsletter subscribe flow (verify token), and a careers page with copy.
 * Every column is additive and backfilled so existing rows keep reading.
 *
 * Datetime columns are deliberate: on MariaDB with
 * explicit_defaults_for_timestamp off, the first TIMESTAMP column of a
 * table silently gets ON UPDATE CURRENT_TIMESTAMP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            if (! Schema::hasColumn('articles', 'slug')) {
                $table->string('slug', 200)->nullable()->unique()->after('title');
            }
            if (! Schema::hasColumn('articles', 'body')) {
                // HTML from the CMS rich-text field; sanitized on the way in.
                $table->longText('body')->nullable()->after('excerpt');
            }
        });

        // Backfill: every note gets a unique slug from its title, and a body
        // from its excerpt so the public article page never opens empty.
        $taken = [];
        foreach (DB::table('articles')->orderBy('id')->get(['id', 'title', 'slug', 'excerpt', 'body']) as $row) {
            $update = [];
            if (! $row->slug) {
                $base = Str::slug(Str::limit((string) $row->title, 80, '')) ?: 'note';
                $slug = $base;
                $n = 2;
                while (isset($taken[$slug]) || DB::table('articles')->where('slug', $slug)->where('id', '!=', $row->id)->exists()) {
                    $slug = $base.'-'.$n++;
                }
                $taken[$slug] = true;
                $update['slug'] = $slug;
            }
            if ($row->body === null && trim((string) $row->excerpt) !== '') {
                $update['body'] = '<p>'.e(trim((string) $row->excerpt)).'</p>';
            }
            if ($update !== []) {
                DB::table('articles')->where('id', $row->id)->update($update);
            }
        }

        Schema::table('subscribers', function (Blueprint $table) {
            if (! Schema::hasColumn('subscribers', 'verify_token')) {
                $table->string('verify_token', 64)->nullable()->unique()->after('verified');
            }
            if (! Schema::hasColumn('subscribers', 'verified_at')) {
                $table->dateTime('verified_at')->nullable()->after('verify_token');
            }
        });

        Schema::table('career_posts', function (Blueprint $table) {
            if (! Schema::hasColumn('career_posts', 'summary')) {
                $table->text('summary')->nullable()->after('location');
            }
            if (! Schema::hasColumn('career_posts', 'body')) {
                $table->longText('body')->nullable()->after('summary');
            }
        });
    }

    public function down(): void
    {
        Schema::table('career_posts', function (Blueprint $table) {
            $table->dropColumn(['summary', 'body']);
        });
        Schema::table('subscribers', function (Blueprint $table) {
            $table->dropUnique(['verify_token']);
            $table->dropColumn(['verify_token', 'verified_at']);
        });
        Schema::table('articles', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'body']);
        });
    }
};
