<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Institutional investor firm. */
class Client extends CrmsModel
{
    protected $table = 'client';

    /** The legacy stand-in for the default form and the shared interaction types. */
    public const GENERIC_NAME = 'Generic Form';

    public static function genericId(): ?int
    {
        $id = static::where('name', self::GENERIC_NAME)->value('id');

        return $id ? (int) $id : null;
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(ClientAddress::class, 'client_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class, 'client_id');
    }

    public function interactions(): HasMany
    {
        return $this->hasMany(Interaction::class, 'client_id');
    }

    public function form(): HasOne
    {
        return $this->hasOne(Form::class, 'client_id');
    }

    public function interactionTypes(): HasMany
    {
        return $this->hasMany(InteractionType::class, 'client_id');
    }

    public function reportTemplate(): HasOne
    {
        return $this->hasOne(ReportTemplate::class, 'client_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'name' => $this->name,
            'region' => $this->region,
            'monikers' => $this->monikers,
            'clientType' => $this->client_type,
            'contactCount' => (int) ($this->contacts_count ?? 0),
            'addressCount' => (int) ($this->addresses_count ?? 0),
            'interactionCount' => (int) ($this->interactions_count ?? 0),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
