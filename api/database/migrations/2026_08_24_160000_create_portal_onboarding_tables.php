<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Portal clients sign in with a Regis-issued user id or their email.
            $table->string('username')->nullable()->unique()->after('email');
            // invited | pending | approved | declined. Staff are always approved.
            $table->string('status', 12)->default('approved')->after('kind');
            $table->string('position')->nullable()->after('firm');
            $table->string('phone', 40)->nullable()->after('position');
            $table->timestamp('registered_at')->nullable()->after('last_active_at');
            $table->timestamp('approved_at')->nullable()->after('registered_at');
        });

        // One-time links for "create your password" and "reset your password".
        Schema::create('portal_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('purpose', 20); // registration | password_reset
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_tokens');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username', 'status', 'position', 'phone', 'registered_at', 'approved_at']);
        });
    }
};
