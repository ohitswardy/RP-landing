<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Which client-specific consumption template a client's By Client report uses. */
class ReportTemplate extends CrmsModel
{
    protected $table = 'report_templates';

    public const CODES = ['corpaxe', 'gmo', 'jpmorgan', 'schroders', 'trowe'];

    protected $casts = ['is_active' => 'boolean'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'clientId' => (string) $this->client_id,
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'code' => $this->code,
            'active' => $this->is_active,
        ];
    }
}
