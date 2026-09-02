<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Editorial classification of a research report — Results, Rating Change,
    Initiation of Coverage, and whatever else the desk adds in the CMS. */
class ReportType extends Model
{
    protected $fillable = ['name'];

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
        ];
    }
}
