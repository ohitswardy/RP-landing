<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * One node of the research distribution hierarchy (Banks, Property, …)
 * under a Domestic or Foreign scope, with the tickers it covers.
 */
class SectorGroup extends CrmsModel
{
    protected $table = 'sector_group';

    public const SCOPES = ['domestic', 'foreign'];

    public function corporates(): BelongsToMany
    {
        return $this->belongsToMany(Corporate::class, 'sector_group_corporate', 'sector_group_id', 'corporate_id');
    }

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(ClientContact::class, 'client_contact_sector_group', 'sector_group_id', 'client_contact_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'name' => $this->name,
            'scope' => $this->scope,
            'position' => (int) $this->position,
            'corporateIds' => $this->relationLoaded('corporates')
                ? $this->corporates->pluck('id')->map(fn ($id) => (string) $id)->values()->all()
                : [],
            'subscriberCount' => (int) ($this->contacts_count ?? 0),
        ];
    }
}
