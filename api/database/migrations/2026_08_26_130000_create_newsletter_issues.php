<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Newsletter issues for the daily / weekly / monthly REGIS mailers.
 * The story sections live as one JSON column — they are only ever
 * read and written as a whole document by the composer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('newsletter_issues', function (Blueprint $table) {
            $table->id();
            $table->string('cadence', 10); // daily | weekly | monthly
            $table->date('date');
            $table->string('subject', 300);
            $table->text('intro');
            $table->json('sections');
            $table->timestamps();

            $table->index(['cadence', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('newsletter_issues');
    }
};
