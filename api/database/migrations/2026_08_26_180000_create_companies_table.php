<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            // Local vs Foreign classification — the portal's companies filter.
            $table->string('type', 20)->default('Local');
            $table->timestamps();
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('category')
                ->constrained('companies')->nullOnDelete();
            // Replaced by the companies registry (reports.company_id → companies.type).
            $table->dropColumn('company');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('company', 20)->default('Local')->after('category');
            $table->dropConstrainedForeignId('company_id');
        });

        Schema::dropIfExists('companies');
    }
};
