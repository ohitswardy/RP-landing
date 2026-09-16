<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Issues migrated from the old regis.ph CMS keep their original id so the
 * importer can be re-run without duplicating them. The intro column grows
 * to MEDIUMTEXT: the monthly commentary the desk filed for years runs past
 * what TEXT holds once it carries entities and inline markup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_issues', function (Blueprint $table) {
            $table->unsignedInteger('legacy_id')->nullable()->unique()->after('id');
            $table->mediumText('intro')->change();
        });
    }

    public function down(): void
    {
        Schema::table('newsletter_issues', function (Blueprint $table) {
            $table->dropUnique(['legacy_id']);
            $table->dropColumn('legacy_id');
            $table->text('intro')->change();
        });
    }
};
