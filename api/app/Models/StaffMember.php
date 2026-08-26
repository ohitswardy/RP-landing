<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffMember extends Model
{
    protected $fillable = [
        'name', 'roles', 'bio', 'sectors', 'phone', 'email',
        'team', 'img', 'visible', 'position',
    ];

    protected function casts(): array
    {
        return [
            'visible' => 'boolean',
            'position' => 'integer',
            'roles' => 'array',
            'bio' => 'array',
            'sectors' => 'array',
        ];
    }

    public function toWire(): array
    {
        $roles = array_values($this->roles ?? []);

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'roles' => $roles,
            /** First title — the one the card and the CMS list show. */
            'role' => $roles[0] ?? '',
            'bio' => array_values($this->bio ?? []),
            'sectors' => array_values($this->sectors ?? []),
            'phone' => (string) $this->phone,
            'email' => (string) $this->email,
            'team' => $this->team,
            'img' => (string) $this->img,
            // getAttribute, not $this->visible: Eloquent already declares a
            // protected $visible (its serialization allow-list), and inside the
            // class that property wins over the column — always yielding [].
            'visible' => (bool) $this->getAttribute('visible'),
            'position' => $this->position,
        ];
    }
}
