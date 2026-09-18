<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use App\Casts\LegacyTime;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A standalone meeting — the legacy `event` table, which also feeds the
 * calendar. Not a roadshow: no child tabs, one client, optionally one
 * corporate, and it converts into an interaction the same way a roadshow
 * meeting does. `classification` is analyst | corporate | expert_meeting.
 */
class OneOffMeeting extends CrmsModel
{
    protected $table = 'event';

    public const CLASSIFICATIONS = ['analyst', 'corporate', 'expert_meeting'];

    protected $casts = [
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'time_start' => LegacyTime::class,
        'time_end' => LegacyTime::class,
        'client_contact' => LegacyJson::class,
        'corporate_contact' => LegacyJson::class,
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function corporate(): BelongsTo
    {
        return $this->belongsTo(Corporate::class, 'corporate_id');
    }

    public function interaction(): BelongsTo
    {
        return $this->belongsTo(Interaction::class, 'interaction_id');
    }

    /**
     * The analysts an `analyst` meeting is about. The legacy app stored the
     * picked sellside contacts as a JSON list in `description`; any other
     * classification keeps `description` as free text.
     */
    public function analysts(): array
    {
        if ($this->classification !== 'analyst') {
            return [];
        }
        $decoded = json_decode((string) $this->description, true);
        if (! is_array($decoded)) {
            return [];
        }

        return array_values(array_filter($decoded, fn ($a) => is_array($a) && isset($a['name'])));
    }

    /** Description as text — null for analyst meetings, whose column holds the analyst list. */
    public function descriptionText(): ?string
    {
        return $this->classification === 'analyst' ? null : $this->description;
    }

    /** Who the meeting is with, for lists and the calendar. */
    public function subject(): string
    {
        $client = $this->client?->name;
        $corp = $this->corporate?->name;

        return match ($this->classification) {
            'corporate' => trim(($client ?? 'Client').' × '.($corp ?? 'Corporate')),
            'expert_meeting' => ($client ?? 'Client').' · expert meeting',
            'analyst' => implode(', ', array_map(fn ($a) => $a['name'], $this->analysts())) ?: ($client ?? 'Analyst meeting'),
            default => $client ?? $corp ?? 'Meeting',
        };
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'category' => 'meetings',
            'categoryLabel' => 'One-Off Meeting',
            'subject' => $this->subject(),
            'startDate' => self::day($this->start_date),
            'endDate' => self::day($this->end_date),
            'timeStart' => $this->time_start,
            'timeEnd' => $this->time_end,
            'timezone' => $this->timezone,
            'location' => $this->location,
            'meetingType' => $this->meeting_type,
            'classification' => $this->classification,
            'description' => $this->descriptionText(),
            'analysts' => $this->analysts(),
            'note' => $this->note,
            'corporateAddress' => $this->corporate_address,
            'clientId' => self::idOrNull($this->client_id),
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'corporateId' => self::idOrNull($this->corporate_id),
            'corporateName' => $this->relationLoaded('corporate') ? $this->corporate?->name : null,
            'clientContacts' => $this->client_contact,
            'corporateContacts' => $this->corporate_contact,
            'interactionId' => self::idOrNull($this->interaction_id),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
