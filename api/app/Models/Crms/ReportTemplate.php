<?php

namespace App\Models\Crms;

use App\Services\Crms\BundledTemplates;
use App\Services\Crms\UploadLayouts;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Which consumption template a client's By Client report uses. The built-in
 * codes are the hand-written layouts in ReportGenerator / UploadLayouts;
 * `commcise` and `jefferies` fill the bundled workbooks the clients sent
 * (BundledTemplates); `custom` is an Excel template the desk imported from
 * the Form builder — the original workbook stays on disk and `layout` maps
 * its columns to system data (see App\Services\Crms\LayoutRenderer).
 *
 * The Jefferies bulk upload is not a By Client report (it lists the whole
 * foreign book), but it is bound to the "Jefferies" client row all the
 * same, so a newer workbook from Jefferies can be imported over the bundled
 * one exactly like a client's; jefferies() resolves that binding.
 */
class ReportTemplate extends CrmsModel
{
    protected $table = 'report_templates';

    public const CODES = ['corpaxe', 'gmo', 'jpmorgan', 'schroders', 'trowe', 'commcise', 'jefferies', 'custom'];

    /** The codes that fill a bundled workbook rather than a hand-written column map. */
    public const BUNDLED = ['commcise', 'jefferies'];

    /**
     * The binding the Jefferies upload renders through: the row bound to
     * `jefferies` (the bundled workbook), else an imported template on the
     * client named Jefferies. Null means the bundled workbook, unbound.
     */
    public static function jefferies(): ?self
    {
        $rows = static::with('client')->where('is_active', true)->whereIn('code', ['jefferies', 'custom'])->orderBy('id')->get();
        $uploads = new UploadLayouts;

        return $rows->first(fn (self $t) => $t->code === 'jefferies')
            ?? $rows->first(fn (self $t) => $t->hasLayout() && $t->client && $uploads->isJefferies($t->client));
    }

    /** Where the imported workbooks live on the private (`local`) disk. */
    public const LAYOUT_DIR = 'crms/report-layouts';

    protected $casts = ['is_active' => 'boolean', 'layout' => 'array', 'layout_imported_at' => 'datetime'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /** True when this binding renders through an imported workbook. */
    public function hasLayout(): bool
    {
        return $this->code === 'custom' && is_array($this->layout) && $this->layout_file !== null;
    }

    public function toWire(): array
    {
        $layout = $this->hasLayout() ? $this->layout : null;

        return [
            'id' => $this->wireId(),
            'clientId' => (string) $this->client_id,
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'code' => $this->code,
            'active' => $this->is_active,
            // The bundled workbook a built-in code fills (the Schroders / JPM Commcise templates, Jefferies' bulk upload), shown like an import.
            'bundled' => ($key = BundledTemplates::forCode($this->code, $this->relationLoaded('client') ? $this->client : null)) ? BundledTemplates::describe($key) : null,
            'layout' => $layout ? [
                'file' => $this->layout_name,
                'title' => $layout['title'] ?? null,
                'sheet' => $layout['sheet'],
                'sheets' => array_values($layout['sheets'] ?? []),
                'headerRow' => (int) $layout['headerRow'],
                'dataStart' => (int) $layout['dataStart'],
                'scope' => $layout['scope'] ?? 'client',
                'columns' => array_values(array_map(fn ($c) => [
                    'index' => (int) $c['index'],
                    'header' => (string) ($c['header'] ?? ''),
                    'source' => (string) $c['source'],
                    'separator' => (string) ($c['separator'] ?? ', '),
                    'format' => $c['format'] ?? null,
                    'text' => $c['text'] ?? null,
                ], $layout['columns'] ?? [])),
                'cells' => array_values(array_map(fn ($c) => ['ref' => (string) $c['ref'], 'source' => (string) $c['source'], 'text' => $c['text'] ?? null], $layout['cells'] ?? [])),
                'importedAt' => $this->layout_imported_at?->toIso8601String(),
            ] : null,
        ];
    }
}
