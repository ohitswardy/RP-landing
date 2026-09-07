<?php

namespace App\Models\Crms;

use App\Casts\LegacyTime;

class Flight extends CrmsModel
{
    protected $table = 'flight';

    protected $casts = [
        'date' => 'datetime',
        'date_arrival' => 'datetime',
        'time' => LegacyTime::class,
        'time_arrival' => LegacyTime::class,
    ];

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'date' => self::day($this->date),
            'time' => $this->time,
            'timezone' => $this->timezone,
            'location' => $this->location,
            'description' => $this->description,
            'dateArrival' => self::day($this->date_arrival),
            'timeArrival' => $this->time_arrival,
            'timezoneArrival' => $this->timezone_arrival,
            'locationArrival' => $this->location_arrival,
            'descriptionArrival' => $this->description_arrival,
            'passenger' => $this->passenger,
            'note' => $this->note,
        ];
    }
}
