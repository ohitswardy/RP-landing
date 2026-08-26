<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceLine extends Model
{
    protected $fillable = [
        'slug', 'eyebrow', 'title', 'dek', 'intro_heading',
        'img', 'hero_images', 'pillars', 'proof', 'live', 'position',
    ];

    protected function casts(): array
    {
        return [
            'live' => 'boolean',
            'position' => 'integer',
            'hero_images' => 'array',
            'pillars' => 'array',
            'proof' => 'array',
        ];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'slug' => $this->slug,
            'eyebrow' => (string) $this->eyebrow,
            'title' => $this->title,
            'dek' => $this->dek,
            'introHeading' => (string) $this->intro_heading,
            'img' => (string) $this->img,
            'heroImages' => array_values($this->hero_images ?? []),
            'pillars' => array_values($this->pillars ?? []),
            'proof' => array_values($this->proof ?? []),
            'live' => $this->live,
            'position' => $this->position,
        ];
    }
}
