<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CareerPost extends Model
{
    protected $fillable = ['title', 'dept', 'type', 'location', 'summary', 'body', 'posted', 'status', 'applicants'];

    protected function casts(): array
    {
        return ['posted' => 'date:Y-m-d', 'applicants' => 'integer'];
    }

    /** Open postings are the ones the public careers page lists. */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', 'open');
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'dept' => $this->dept,
            'type' => $this->type,
            'location' => $this->location,
            'summary' => (string) $this->summary,
            'body' => (string) $this->body,
            'posted' => $this->posted->format('Y-m-d'),
            'status' => $this->status,
            'applicants' => $this->applicants,
        ];
    }
}
