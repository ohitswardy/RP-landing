<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CareerPost extends Model
{
    protected $fillable = ['title', 'dept', 'type', 'location', 'posted', 'status', 'applicants'];

    protected function casts(): array
    {
        return ['posted' => 'date:Y-m-d', 'applicants' => 'integer'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'dept' => $this->dept,
            'type' => $this->type,
            'location' => $this->location,
            'posted' => $this->posted->format('Y-m-d'),
            'status' => $this->status,
            'applicants' => $this->applicants,
        ];
    }
}
