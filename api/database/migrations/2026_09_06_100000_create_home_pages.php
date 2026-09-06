<?php

use App\Support\HomeDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The landing page's editable copy and photography — hero, numbers,
 * services index, insights, the story panels, the President's word, and
 * the careers banner — as one JSON document. A singleton row, planted
 * here so an existing installation has it without re-seeding.
 *
 * Also registers the `home.manage` permission and hands it to every role
 * that already publishes site copy (any role holding `services.manage`),
 * so administrators and editors see the module the moment it deploys.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_pages', function (Blueprint $table) {
            $table->id();
            $table->json('content');
            $table->timestamps();
        });

        $now = now();
        DB::table('home_pages')->insert([
            'content' => json_encode(HomeDefaults::content(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $permissionId = DB::table('permissions')->where('key', 'home.manage')->value('id');
        if (! $permissionId) {
            $permissionId = DB::table('permissions')->insertGetId([
                'key' => 'home.manage',
                'label' => 'Landing page',
                'group' => 'Site content',
            ]);
        }

        $servicesId = DB::table('permissions')->where('key', 'services.manage')->value('id');
        if ($servicesId) {
            $roleIds = DB::table('permission_role')->where('permission_id', $servicesId)->pluck('role_id');
            $already = DB::table('permission_role')->where('permission_id', $permissionId)->pluck('role_id')->all();

            $rows = $roleIds
                ->reject(fn ($id) => in_array($id, $already, false))
                ->map(fn ($id) => ['permission_id' => $permissionId, 'role_id' => $id])
                ->values()
                ->all();

            if ($rows) {
                DB::table('permission_role')->insert($rows);
            }
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('key', 'home.manage')->value('id');
        if ($permissionId) {
            DB::table('permission_role')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }

        Schema::dropIfExists('home_pages');
    }
};
