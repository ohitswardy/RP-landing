<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Insights lose the 'draft' state; every note is either in review or published.
     */
    public function up(): void
    {
        DB::table('articles')->where('status', 'draft')->update(['status' => 'review']);

        Schema::table('articles', function (Blueprint $table) {
            $table->string('status', 12)->default('review')->comment('published | review')->change();
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->string('status', 12)->default('draft')->comment('published | review | draft')->change();
        });
    }
};
