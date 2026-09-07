<?php

namespace App\Models\Crms;

use App\Casts\LegacyTime;

class Accommodation extends CrmsModel
{
    protected $table = 'accommodation';

    protected $casts = [
        'date' => 'datetime',
        'date_out' => 'datetime',
        'time_in' => LegacyTime::class,
        'time_out' => LegacyTime::class,
    ];

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'date' => self::day($this->date),
            'timeIn' => $this->time_in,
            'dateOut' => self::day($this->date_out),
            'timeOut' => $this->time_out,
            'location' => $this->location,
            'description' => $this->description,
            'accommodator' => $this->accommodator,
            'note' => $this->note,
        ];
    }
}
