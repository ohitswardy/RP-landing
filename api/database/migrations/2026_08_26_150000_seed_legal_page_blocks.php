<?php

use App\Support\LegalDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Page copy becomes Legal: `page_blocks` now holds only the Terms &
 * Conditions and the Privacy & Cookies Policy, one row per section, ordered
 * by `position`. The placeholder blocks that nothing on the site ever read
 * are dropped along with the two one-paragraph Legal stubs they shipped with.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('page_blocks', 'position')) {
            Schema::table('page_blocks', function (Blueprint $table) {
                $table->unsignedInteger('position')->default(0)->after('field');
            });
        }

        DB::table('page_blocks')->delete();

        $now = now();
        $today = $now->toDateString();

        DB::table('page_blocks')->insert(array_map(fn (array $b) => $b + [
            'updated' => $today,
            'editor' => 'Systems',
            'created_at' => $now,
            'updated_at' => $now,
        ], LegalDefaults::blocks()));

        DB::table('permissions')->where('key', 'pages.manage')->update(['label' => 'Legal']);
    }

    public function down(): void
    {
        DB::table('permissions')->where('key', 'pages.manage')->update(['label' => 'Page copy']);

        if (Schema::hasColumn('page_blocks', 'position')) {
            Schema::table('page_blocks', function (Blueprint $table) {
                $table->dropColumn('position');
            });
        }
    }
};
