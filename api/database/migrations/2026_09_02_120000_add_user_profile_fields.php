<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Richer account profiles feeding the Email desk and the future CRMS:
     * clients carry a Local/Foreign classification plus research preferences
     * (sectors, analysts) used to auto-match report blasts; staff carry the
     * Outlook address their blasts go out from.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('client_type', 10)->nullable()->after('firm')->comment('Local | Foreign (clients only)');
            $table->json('sector_prefs')->nullable()->after('client_type');
            $table->json('preferred_analysts')->nullable()->after('sector_prefs');
            $table->string('outlook_email', 190)->nullable()->after('preferred_analysts')->comment('Staff only: the Outlook account blasts are sent from');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['client_type', 'sector_prefs', 'preferred_analysts', 'outlook_email']);
        });
    }
};
