<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use App\Enums\Crms\EventCategory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The parent record for all four event modules — the legacy `roadshow`
 * table, discriminated by `category` (EventCategory). Meetings, investors,
 * logistics and the REGIS party hang off it as child rows.
 */
class Event extends CrmsModel
{
    protected $table = 'roadshow';

    protected $casts = [
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'client_contact' => LegacyJson::class,
        'sellside_contact' => LegacyJson::class,
    ];

    /** Child resources, keyed by their URL segment. */
    public const CHILDREN = [
        'meetings' => Meeting::class,
        'investors' => Investor::class,
        'flights' => Flight::class,
        'transportation' => Transportation::class,
        'accommodation' => Accommodation::class,
        'attendees' => EventAttendee::class,
    ];

    public function corporate(): BelongsTo
    {
        return $this->belongsTo(Corporate::class, 'corporate_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(Meeting::class, 'roadshow_id')->orderBy('date')->orderBy('time_start');
    }

    public function investors(): HasMany
    {
        return $this->hasMany(Investor::class, 'roadshow_id');
    }

    public function flights(): HasMany
    {
        return $this->hasMany(Flight::class, 'roadshow_id')->orderBy('date')->orderBy('time');
    }

    public function transportation(): HasMany
    {
        return $this->hasMany(Transportation::class, 'roadshow_id')->orderBy('date')->orderBy('start_time');
    }

    public function accommodation(): HasMany
    {
        return $this->hasMany(Accommodation::class, 'roadshow_id')->orderBy('date');
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(EventAttendee::class, 'roadshow_id');
    }

    public function category(): ?EventCategory
    {
        return EventCategory::tryFrom((int) $this->getAttribute('category'));
    }

    /** What the event is about: the issuer, the host client, or the analyst. */
    public function subject(): string
    {
        return match ($this->category()) {
            EventCategory::Roadshow => $this->corporate?->name ?? 'Corporate',
            EventCategory::ReverseRoadshow => $this->client?->name ?? 'Client',
            EventCategory::AnalystMarketing => implode(', ', array_map(fn ($s) => $s['name'] ?? '', $this->sellside_contact)) ?: 'Analyst',
            default => $this->corporate?->name ?? $this->client?->name ?? 'Event',
        };
    }

    public function toWire(): array
    {
        $cat = $this->category();

        return [
            'id' => $this->wireId(),
            'category' => $cat?->slug() ?? 'roadshows',
            'categoryLabel' => $cat?->label() ?? 'Event',
            'classification' => $this->classification,
            'subject' => $this->subject(),
            'startDate' => self::day($this->start_date),
            'endDate' => self::day($this->end_date),
            'coordinator' => $this->coordinator,
            'telNo' => $this->tel_no,
            'mobileNo' => $this->mobile_no,
            'email' => $this->email,
            'corporateId' => self::idOrNull($this->corporate_id),
            'corporateName' => $this->relationLoaded('corporate') ? $this->corporate?->name : null,
            'clientId' => self::idOrNull($this->client_id),
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'clientContacts' => $this->client_contact,
            'sellsideContacts' => $this->sellside_contact,
            'meetingCount' => (int) ($this->meetings_count ?? 0),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
