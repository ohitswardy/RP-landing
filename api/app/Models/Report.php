<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Report extends Model
{
    protected $fillable = [
        'title', 'category', 'company_id', 'analyst', 'date', 'pages', 'summary',
        'spotlight', 'file_name', 'file_size', 'file_url', 'file_path',
    ];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'pages' => 'integer', 'file_size' => 'integer', 'spotlight' => 'boolean'];
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'category' => $this->category,
            'companyId' => $this->company_id !== null ? (string) $this->company_id : null,
            'companyName' => $this->company?->name,
            // Local/Foreign classification, derived from the linked company.
            'company' => $this->company?->type,
            'analyst' => $this->analyst,
            'date' => $this->date->format('Y-m-d'),
            'pages' => $this->pages,
            'summary' => $this->summary,
            // The one report showcased on the portal dashboard's Spotlight card.
            'spotlight' => (bool) $this->spotlight,
            'fileName' => $this->file_name,
            'fileSize' => $this->file_size,
            // Public catalog URL, or null when the PDF streams from the API.
            'fileUrl' => $this->file_url,
        ];
    }
}
