<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The /insights journal page: everything around the note ledger — hero,
 * filter rail, list options, sign-in prompt — as one JSON document, plus
 * the per-note `featured` flag that promotes one note to the lead block.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insight_pages', function (Blueprint $table) {
            $table->id();
            $table->json('content');
            $table->timestamps();
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->boolean('featured')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('featured');
        });

        Schema::dropIfExists('insight_pages');
    }
};
