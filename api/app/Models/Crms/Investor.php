<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A client firm plus the contacts of theirs attending an event. */
class Investor extends CrmsModel
{
    protected $table = 'investor';

    protected $casts = ['client_contact' => LegacyJson::class];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'clientId' => self::idOrNull($this->client_id),
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'clientContacts' => $this->client_contact,
        ];
    }
}
