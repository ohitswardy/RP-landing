<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Form-builder definition: the dynamic fields an interaction with this
 * client captures. client_id null is the default form every client without
 * its own falls back to. Field shape: Database.md §5.
 */
class Form extends CrmsModel
{
    protected $table = 'form';

    protected $casts = ['fields' => LegacyJson::class];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /** The form a client's interactions render: its own, else the default, else the "Generic Form" client's. */
    public static function forClient(?int $clientId): ?self
    {
        return ($clientId ? static::where('client_id', $clientId)->first() : null)
            ?? static::whereNull('client_id')->first()
            ?? (($g = Client::genericId()) ? static::where('client_id', $g)->first() : null);
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'clientId' => self::idOrNull($this->client_id),
            'fields' => $this->fields,
        ];
    }
}
