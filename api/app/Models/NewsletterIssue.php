<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterIssue extends Model
{
    protected $fillable = ['cadence', 'date', 'subject', 'intro', 'sections'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'sections' => 'array'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'cadence' => $this->cadence,
            'date' => $this->date->format('Y-m-d'),
            'subject' => $this->subject,
            'intro' => $this->intro,
            'sections' => $this->sections ?? [],
            'updated' => $this->updated_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
