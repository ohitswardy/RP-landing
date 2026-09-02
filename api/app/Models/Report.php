<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Report extends Model
{
    protected $fillable = [
        'title', 'category', 'report_type_id', 'company_id', 'analyst', 'rating', 'date', 'pages', 'summary',
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

    public function reportType(): BelongsTo
    {
        return $this->belongsTo(ReportType::class);
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'category' => $this->category,
            'reportTypeId' => $this->report_type_id !== null ? (string) $this->report_type_id : null,
            'reportType' => $this->reportType?->name,
            'companyId' => $this->company_id !== null ? (string) $this->company_id : null,
            'companyName' => $this->company?->name,
            // Ticker of the linked company, mirrored so lists need no join.
            'companySymbol' => $this->company?->symbol,
            // Local/Foreign classification, derived from the linked company.
            'company' => $this->company?->type,
            'analyst' => $this->analyst,
            // Buy / Hold / Sell; null on unrated research.
            'rating' => $this->rating,
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
