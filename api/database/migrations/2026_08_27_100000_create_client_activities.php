<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Actor snapshot — the ledger stays whole even if the account goes.
            $table->string('actor_name', 120);
            $table->string('actor_email', 190);
            $table->string('actor_firm', 190)->nullable();
            $table->string('event', 12)->index(); // view | download | click
            $table->foreignId('report_id')->nullable()->constrained()->nullOnDelete();
            $table->string('target', 500);
            $table->string('context', 40)->default('');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('occurred_at')->index();
            // Tamper-evident chain: each row seals its payload plus the previous
            // row's hash under the app key (HMAC-SHA256). Editing or deleting any
            // row breaks every hash after it.
            $table->char('prev_hash', 64)->nullable();
            $table->char('hash', 64);
        });

        // The CMS module is gated by its own permission. Insert it here so a
        // database that already ran RbacSeeder picks it up without reseeding.
        $permId = DB::table('permissions')->insertGetId([
            'key' => 'logs.view', 'label' => 'Client logs', 'group' => 'Systems',
        ]);

        // Administrator always holds every permission.
        $adminIds = DB::table('roles')->where('is_system', true)->pluck('id');
        foreach ($adminIds as $roleId) {
            DB::table('permission_role')->insertOrIgnore([
                'permission_id' => $permId, 'role_id' => $roleId,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('permissions')->where('key', 'logs.view')->delete();
        Schema::dropIfExists('client_activities');
    }
};
