<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientAddress extends CrmsModel
{
    protected $table = 'client_address';

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'clientId' => self::idOrNull($this->client_id),
            'name' => $this->name ?? '',
        ];
    }
}
