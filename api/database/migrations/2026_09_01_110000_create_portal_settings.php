<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Singleton row (see PortalSetting::current) — knobs for the client
        // portal dashboard, starting with the Trending Content ranking rules.
        Schema::create('portal_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('trending_enabled')->default(true);
            $table->string('trending_metric', 20)->default('views'); // views | downloads | engagement
            $table->unsignedTinyInteger('trending_window_months')->default(3); // 0 = all time
            $table->unsignedTinyInteger('trending_limit')->default(3);
            $table->unsignedSmallInteger('trending_min_events')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_settings');
    }
};
