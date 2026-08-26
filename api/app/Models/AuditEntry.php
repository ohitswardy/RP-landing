<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEntry extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'actor', 'action', 'target', 'at'];

    protected function casts(): array
    {
        return ['at' => 'datetime'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'actor' => $this->actor,
            'action' => $this->action,
            'target' => $this->target,
            'at' => $this->at->toIso8601String(),
        ];
    }
}
