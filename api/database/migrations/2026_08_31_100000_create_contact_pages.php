<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Contact page's editable copy — hero caption, the inquiry panel
 * beside the form, and the office ledger — as one JSON document. A
 * singleton row, lazily seeded by ContactPage::current().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_pages', function (Blueprint $table) {
            $table->id();
            $table->json('content');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_pages');
    }
};
