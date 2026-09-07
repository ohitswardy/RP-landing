<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use App\Casts\LegacyTime;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One meeting slot inside an event. corporate_type: client | corporate | expert_meeting. */
class Meeting extends CrmsModel
{
    protected $table = 'meeting';

    public const CLASSIFICATIONS = ['client', 'corporate', 'expert_meeting'];

    protected $casts = [
        'date' => 'datetime',
        'time_start' => LegacyTime::class,
        'time_end' => LegacyTime::class,
        'client_contact' => LegacyJson::class,
        'corporate_contact' => LegacyJson::class,
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'roadshow_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function corporate(): BelongsTo
    {
        return $this->belongsTo(Corporate::class, 'corporate_id');
    }

    /** Who the party is meeting, for lists and the itinerary. */
    public function counterparty(): string
    {
        return match ($this->corporate_type) {
            'client' => $this->client?->name ?? 'Client',
            'corporate' => $this->corporate?->name ?? 'Corporate',
            default => $this->description ?: 'Expert meeting',
        };
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'date' => self::day($this->date),
            'timeStart' => $this->time_start,
            'timeEnd' => $this->time_end,
            'timezone' => $this->timezone,
            'location' => $this->location,
            'meetingType' => $this->meeting_type,
            'classification' => $this->corporate_type,
            'description' => $this->description,
            'contact' => $this->contact,
            'bookedBy' => $this->booked_by,
            'note' => $this->note,
            'corporateAddress' => $this->corporate_address,
            'clientContacts' => $this->client_contact,
            'corporateContacts' => $this->corporate_contact,
            'clientId' => self::idOrNull($this->client_id),
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'corporateId' => self::idOrNull($this->corporate_id),
            'corporateName' => $this->relationLoaded('corporate') ? $this->corporate?->name : null,
            'counterparty' => $this->counterparty(),
            'interactionId' => self::idOrNull($this->interaction_id),
        ];
    }
}
