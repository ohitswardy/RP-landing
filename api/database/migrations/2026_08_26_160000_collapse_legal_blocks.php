<?php

use App\Support\LegalDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Each legal document becomes a single body of text instead of one row per
 * clause — the Legal module edits the whole policy in one box. Existing
 * clauses are folded into that body under `## ` heading lines rather than
 * discarded, so any copy already edited survives.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('page_blocks', function (Blueprint $table) {
            $table->mediumText('value')->change();
        });

        $defaults = collect(LegalDefaults::blocks())->keyBy(fn (array $b) => $b['page'].'|'.$b['field']);

        foreach (LegalDefaults::titles() as $title) {
            $rows = DB::table('page_blocks')->where('page', $title)
                ->orderBy('position')->orderBy('id')->get();

            $clauses = $rows->reject(fn ($r) => $r->field === LegalDefaults::EFFECTIVE);

            $body = $clauses
                ->map(fn ($r) => $r->field === LegalDefaults::DOCUMENT ? $r->value : "## {$r->field}\n\n{$r->value}")
                ->implode("\n\n");

            $effective = $rows->firstWhere('field', LegalDefaults::EFFECTIVE);

            $this->replace($title, [
                LegalDefaults::EFFECTIVE => $effective->value ?? $defaults[$title.'|'.LegalDefaults::EFFECTIVE]['value'],
                LegalDefaults::DOCUMENT => $body !== '' ? $body : $defaults[$title.'|'.LegalDefaults::DOCUMENT]['value'],
            ], $rows->max('updated'), optional($clauses->last())->editor);
        }
    }

    public function down(): void
    {
        foreach (LegalDefaults::titles() as $title) {
            $rows = DB::table('page_blocks')->where('page', $title)->get();
            $effective = $rows->firstWhere('field', LegalDefaults::EFFECTIVE);
            $document = $rows->firstWhere('field', LegalDefaults::DOCUMENT);

            $blocks = [LegalDefaults::EFFECTIVE => $effective->value ?? ''];

            // Split the body back out at its `## ` heading lines.
            foreach (preg_split('/^##[ \t]+/m', (string) ($document->value ?? '')) as $chunk) {
                $chunk = trim((string) $chunk);
                if ($chunk === '') {
                    continue;
                }
                [$heading, $text] = array_pad(explode("\n", $chunk, 2), 2, '');
                $blocks[trim($heading)] = trim($text);
            }

            $this->replace($title, $blocks, $rows->max('updated'), optional($document)->editor);
        }

        Schema::table('page_blocks', function (Blueprint $table) {
            $table->text('value')->change();
        });
    }

    /** Rewrite one document's blocks, in the order given. */
    private function replace(string $page, array $blocks, ?string $updated, ?string $editor): void
    {
        $now = now();
        $rows = [];
        $position = 0;

        foreach ($blocks as $field => $value) {
            $rows[] = [
                'page' => $page,
                'field' => $field,
                'position' => $position++,
                'value' => $value,
                'updated' => $updated ?: $now->toDateString(),
                'editor' => $editor ?: 'Systems',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('page_blocks')->where('page', $page)->delete();
        DB::table('page_blocks')->insert($rows);
    }
};
