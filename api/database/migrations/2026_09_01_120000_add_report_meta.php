<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The desk's starting report types; the CMS can add, rename, or remove any of them. */
    private const TYPES = [
        'Company Update',
        'Forecast Change',
        'Industry Update',
        'Initiation of Coverage',
        'Rating Change',
        'Results',
        'Strategy Update',
    ];

    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            // Exchange ticker, e.g. ALI. Nullable — unlisted names carry no symbol.
            $table->string('symbol', 20)->nullable()->unique()->after('name');
        });

        Schema::create('report_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            $table->timestamps();
        });

        $now = now();
        DB::table('report_types')->insert(array_map(
            fn (string $name) => ['name' => $name, 'created_at' => $now, 'updated_at' => $now],
            self::TYPES,
        ));

        Schema::table('reports', function (Blueprint $table) {
            // Editorial classification (Results, Rating Change, …), from the registry.
            $table->foreignId('report_type_id')->nullable()->after('category')
                ->constrained('report_types')->nullOnDelete();
            // Buy / Hold / Sell. Null for macro and other unrated research.
            $table->string('rating', 10)->nullable()->after('analyst');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('report_type_id');
            $table->dropColumn('rating');
        });

        Schema::dropIfExists('report_types');

        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['symbol']);
            $table->dropColumn('symbol');
        });
    }
};
