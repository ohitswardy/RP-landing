<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Listed company / issuer. */
class Corporate extends CrmsModel
{
    protected $table = 'corporate';

    protected $casts = ['corporate_contacts' => LegacyJson::class];

    public function contacts(): HasMany
    {
        return $this->hasMany(CorporateContact::class, 'corporate_id');
    }

    public function sectorGroups(): BelongsToMany
    {
        return $this->belongsToMany(SectorGroup::class, 'sector_group_corporate', 'corporate_id', 'sector_group_id');
    }

    /** The shape stored inside client_contact.own / .watchlist. */
    public function toSnapshot(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->name,
            'ticker' => $this->ticker,
            'identifiers1' => $this->identifiers1,
            'identifiers2' => $this->identifiers2,
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'name' => $this->name,
            'ticker' => $this->ticker,
            'identifiers1' => $this->identifiers1,
            'identifiers2' => $this->identifiers2,
            'address' => $this->address,
            'sectorGeneric' => $this->sector_generic,
            'sectorGmo' => $this->sector_gmo,
            'sectorJpmorgan' => $this->sector_jpmorgan,
            'sectorSchroders' => $this->sector_schroders,
            'sectorTrowe' => $this->sector_trowe,
            'contactCount' => (int) ($this->contacts_count ?? 0),
        ];
    }
}
