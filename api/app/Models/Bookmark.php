<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bookmark extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'report_id', 'saved_at'];

    protected function casts(): array
    {
        return ['saved_at' => 'datetime'];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }
}
