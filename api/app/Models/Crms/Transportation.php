<?php

namespace App\Models\Crms;

use App\Casts\LegacyTime;

/** Ground transportation — the legacy `transpo` table. */
class Transportation extends CrmsModel
{
    protected $table = 'transpo';

    protected $casts = [
        'date' => 'datetime',
        'start_time' => LegacyTime::class,
        'end_time' => LegacyTime::class,
    ];

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'eventId' => (string) $this->roadshow_id,
            'date' => self::day($this->date),
            'startTime' => $this->start_time,
            'endTime' => $this->end_time,
            'timezone' => $this->timezone,
            'location' => $this->location,
            'description' => $this->description,
            'driverName' => $this->driver_name,
            'driverMobile' => $this->driver_mobile,
            'vehicleType' => $this->vehicle_type,
            'confirmNo' => $this->confirm_no,
            'remarks' => $this->remarks,
            'passenger' => $this->passenger,
            'note' => $this->note,
        ];
    }
}
