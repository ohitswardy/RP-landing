<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Room for the accounts exported from the old regis.ph CMS.
     *
     * - An email is unique per kind, not per table: the legacy system let staff
     *   hold a portal client account under their work address (18 do), and the
     *   CMS and portal logins already filter by kind.
     * - `legacy_id` keeps the old primary key so a re-import updates in place.
     * - `legacy_meta` carries what the new schema has no column for (address,
     *   MiFID flag, rolled-up login and read counts, data-quality flags).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_email_unique');
            $table->unique(['email', 'kind']);
            $table->unsignedInteger('legacy_id')->nullable()->after('id');
            $table->unique(['legacy_id', 'kind']);
            $table->json('legacy_meta')->nullable()->after('outlook_email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['legacy_id', 'kind']);
            $table->dropColumn(['legacy_id', 'legacy_meta']);
            $table->dropUnique(['email', 'kind']);
            $table->unique('email');
        });
    }
};
