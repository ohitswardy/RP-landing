<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The monthly mailer's right-hand rail — the heading-and-graphic blocks
 * printed beside the month commentary (the index chart, the Key data
 * table). One JSON document, written and read whole by the composer
 * like `sections`; empty on the daily and weekly, which have no such
 * column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_issues', function (Blueprint $table) {
            $table->json('rail')->nullable()->after('sections');
        });
    }

    public function down(): void
    {
        Schema::table('newsletter_issues', function (Blueprint $table) {
            $table->dropColumn('rail');
        });
    }
};
