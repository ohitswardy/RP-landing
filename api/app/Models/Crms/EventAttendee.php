<?php

namespace App\Models\Crms;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** REGIS staff on an event — the legacy `bank` table, labelled "Regis" in the UI. */
class EventAttendee extends CrmsModel
{
    protected $table = 'bank';

    public function sellsideContact(): BelongsTo
    {
        return $this->belongsTo(SellsideContact::class, 'sellside_contact_id');
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'sellsideContactId' => (string) $this->sellside_contact_id,
            'name' => $this->relationLoaded('sellsideContact') ? $this->sellsideContact?->name : null,
            'position' => $this->position,
            'officeNo' => $this->office_no,
            'mobileNo' => $this->mobile_no,
            'email' => $this->email,
        ];
    }
}
