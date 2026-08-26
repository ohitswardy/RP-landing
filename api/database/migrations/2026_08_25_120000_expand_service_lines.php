<?php

use App\Support\ServiceDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Service lines grow from a copy stub into the full page record the CMS
 * edits: hero gallery, pillars, and proof stats. `pillars` flips from a
 * count to the structured list it was always counting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_pages', function (Blueprint $table) {
            $table->id();
            $table->string('eyebrow')->default('');
            $table->string('title');
            $table->text('dek');
            $table->string('hero_image')->default('');
            $table->string('card_cta')->default('Read the practice brief');
            $table->timestamps();
        });

        Schema::table('service_lines', function (Blueprint $table) {
            $table->string('eyebrow')->default('Service')->after('slug');
            $table->string('intro_heading')->default('What the practice delivers.')->after('dek');
            $table->json('hero_images')->nullable()->after('img');
            $table->json('proof')->nullable()->after('hero_images');
            $table->unsignedInteger('position')->default(0)->after('live');
        });

        // Two statements: MySQL cannot drop and re-add the same column at once.
        Schema::table('service_lines', function (Blueprint $table) {
            $table->dropColumn('pillars');
        });
        Schema::table('service_lines', function (Blueprint $table) {
            $table->json('pillars')->nullable()->after('intro_heading');
        });

        $this->backfill();
    }

    /** Give rows seeded before this migration the structured content they now need. */
    private function backfill(): void
    {
        foreach (ServiceDefaults::lines() as $i => $line) {
            DB::table('service_lines')->where('slug', $line['slug'])->update([
                'eyebrow' => $line['eyebrow'],
                'intro_heading' => $line['intro_heading'],
                'hero_images' => json_encode($line['hero_images']),
                'pillars' => json_encode($line['pillars']),
                'proof' => json_encode($line['proof']),
                'position' => $i,
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('service_lines', function (Blueprint $table) {
            $table->dropColumn(['eyebrow', 'intro_heading', 'hero_images', 'proof', 'position', 'pillars']);
        });
        Schema::table('service_lines', function (Blueprint $table) {
            $table->unsignedTinyInteger('pillars')->default(4);
        });

        Schema::dropIfExists('service_pages');
    }
};
