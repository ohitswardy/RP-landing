<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Issuer-side individual (IR officer, CFO…). `corporate_id` is the additive FK. */
class CorporateContact extends CrmsModel
{
    protected $table = 'corporate_contact';

    protected $casts = ['analyst' => LegacyJson::class];

    public function corporate(): BelongsTo
    {
        return $this->belongsTo(Corporate::class, 'corporate_id');
    }

    public function toSnapshot(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->name,
            'position' => $this->position,
            'email' => $this->email,
            'mobile' => $this->mobile,
            'phone' => $this->phone,
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'corporateId' => self::idOrNull($this->corporate_id),
            'corporateName' => $this->relationLoaded('corporate') ? $this->corporate?->name : null,
            'name' => $this->name,
            'position' => $this->position,
            'address' => $this->address,
            'email' => $this->email,
            'mobile' => $this->mobile,
            'phone' => $this->phone,
            'assistant' => $this->assistant,
            'assistantEmail' => $this->assistant_email,
            'analyst' => $this->analyst,
        ];
    }
}
