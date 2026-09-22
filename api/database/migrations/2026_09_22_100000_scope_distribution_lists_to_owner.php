<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distribution lists become personal: every staff member with the Email
 * desk keeps their own, so a name only has to be unique per owner rather
 * than across the desk.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_lists', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->unique(['created_by', 'name']);
        });
    }

    public function down(): void
    {
        Schema::table('distribution_lists', function (Blueprint $table) {
            $table->dropUnique(['created_by', 'name']);
            $table->unique(['name']);
        });
    }
};
