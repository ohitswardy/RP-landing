<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An imported Excel template per client binding (Form builder → Report
 * template). The original workbook is kept on the private disk and filled
 * row by row at report time; `layout` holds the column → data-source map.
 * Additive and guarded, like every CRMS migration.
 */
return new class extends Migration
{
    protected $connection = 'crms';

    public function up(): void
    {
        $s = Schema::connection('crms');
        if (! $s->hasTable('report_templates')) {
            return;
        }
        $s->table('report_templates', function (Blueprint $t) use ($s) {
            if (! $s->hasColumn('report_templates', 'layout')) {
                $t->longText('layout')->nullable();
            }
            if (! $s->hasColumn('report_templates', 'layout_file')) {
                $t->string('layout_file', 255)->nullable();
            }
            if (! $s->hasColumn('report_templates', 'layout_name')) {
                $t->string('layout_name', 255)->nullable();
            }
            if (! $s->hasColumn('report_templates', 'layout_imported_at')) {
                $t->dateTime('layout_imported_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        $s = Schema::connection('crms');
        if (! $s->hasTable('report_templates')) {
            return;
        }
        $s->table('report_templates', function (Blueprint $t) use ($s) {
            foreach (['layout', 'layout_file', 'layout_name', 'layout_imported_at'] as $col) {
                if ($s->hasColumn('report_templates', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
    }
};
