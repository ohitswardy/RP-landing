<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscriber extends Model
{
    protected $fillable = ['email', 'firm', 'joined', 'source', 'verified'];

    protected function casts(): array
    {
        return ['joined' => 'date:Y-m-d', 'verified' => 'boolean'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'firm' => $this->firm,
            'joined' => $this->joined->format('Y-m-d'),
            'source' => $this->source,
            'verified' => $this->verified,
        ];
    }
}
