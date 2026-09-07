<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Per-client interaction taxonomy; client_id null = global type. */
class InteractionType extends CrmsModel
{
    protected $table = 'interactionsType';

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /** meeting_type is a newline-delimited list of allowed sub-types. */
    public function meetingTypes(): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $this->meeting_type))));
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'type' => $this->type,
            'meetingTypes' => $this->meetingTypes(),
            'clientId' => self::idOrNull($this->client_id),
        ];
    }
}
