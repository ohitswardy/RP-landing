<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WatchSymbol extends Model
{
    protected $fillable = ['sym', 'name', 'pinned', 'position'];

    protected function casts(): array
    {
        return ['pinned' => 'boolean', 'position' => 'integer'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'sym' => $this->sym,
            'name' => $this->name,
            'pinned' => $this->pinned,
        ];
    }
}
