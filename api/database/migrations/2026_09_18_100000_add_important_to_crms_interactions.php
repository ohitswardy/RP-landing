<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An interaction can be marked important — pinned to the CRMS dashboard so
 * the desk finds it without filtering. Additive only (CRMSmasterplan §11.5):
 * three columns and one index on the legacy `interactions` table, each
 * guarded so the migration is safe against the production dump.
 */
return new class extends Migration
{
    protected $connection = 'crms';

    public function up(): void
    {
        $s = Schema::connection('crms');

        if (! $s->hasColumn('interactions', 'important')) {
            $s->table('interactions', fn (Blueprint $t) => $t->boolean('important')->default(false));
        }
        if (! $s->hasColumn('interactions', 'important_note')) {
            $s->table('interactions', fn (Blueprint $t) => $t->string('important_note', 280)->nullable());
        }
        if (! $s->hasColumn('interactions', 'important_at')) {
            $s->table('interactions', fn (Blueprint $t) => $t->dateTime('important_at')->nullable());
        }
        if (! $s->hasIndex('interactions', 'interactions_important_date_idx')) {
            $s->table('interactions', fn (Blueprint $t) => $t->index(['important', 'interaction_date'], 'interactions_important_date_idx'));
        }
    }

    public function down(): void
    {
        $s = Schema::connection('crms');

        if ($s->hasIndex('interactions', 'interactions_important_date_idx')) {
            $s->table('interactions', fn (Blueprint $t) => $t->dropIndex('interactions_important_date_idx'));
        }
        foreach (['important_at', 'important_note', 'important'] as $column) {
            if ($s->hasColumn('interactions', $column)) {
                $s->table('interactions', fn (Blueprint $t) => $t->dropColumn($column));
            }
        }
    }
};
