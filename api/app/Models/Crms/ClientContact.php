<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * An individual at a client firm. `portal_user_id` is the bridge to the
 * portal account in regisph.users — cross-database, so an unconstrained
 * integer resolved by PortalAccountResolver rather than a relation.
 */
class ClientContact extends CrmsModel
{
    protected $table = 'client_contact';

    protected $casts = [
        'own' => LegacyJson::class,
        'watchlist' => LegacyJson::class,
        'coverage_team' => LegacyJson::class,
        'sales' => LegacyJson::class,
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(ClientAddress::class, 'client_address_id');
    }

    public function sectorGroups(): BelongsToMany
    {
        return $this->belongsToMany(SectorGroup::class, 'client_contact_sector_group', 'client_contact_id', 'sector_group_id');
    }

    public function fullName(): string
    {
        return trim(($this->firstname ?? '').' '.($this->lastname ?? ''));
    }

    /** The point-in-time copy saved onto interactions and event attendee lists. */
    public function toSnapshot(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->fullName(),
            'firstname' => $this->firstname,
            'lastname' => $this->lastname,
            'email' => $this->email,
            'position' => $this->position,
            'contact_no' => $this->contact_no,
            'mobile_no' => $this->mobile_no,
            'client_id' => (int) $this->client_id,
            'client_name' => $this->relationLoaded('client') ? $this->client?->name : null,
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'clientId' => (string) $this->client_id,
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'addressId' => self::idOrNull($this->client_address_id),
            'firstName' => $this->firstname ?? '',
            'lastName' => $this->lastname ?? '',
            'name' => $this->fullName(),
            'email' => $this->email,
            'contactNo' => $this->contact_no,
            'mobileNo' => $this->mobile_no,
            'position' => $this->position,
            'country' => $this->country,
            'own' => $this->own,
            'watchlist' => $this->watchlist,
            'coverageTeam' => $this->coverage_team,
            'sales' => $this->sales,
            'assistant' => $this->assistant,
            'assistantEmail' => $this->assistant_email,
            'assistantContactNo' => $this->assistant_contact_no,
            'portalUserId' => self::idOrNull($this->portal_user_id),
            'sectorGroupIds' => $this->relationLoaded('sectorGroups')
                ? $this->sectorGroups->pluck('id')->map(fn ($id) => (string) $id)->values()->all()
                : [],
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
