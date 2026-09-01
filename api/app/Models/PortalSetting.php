<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Singleton record of client-portal dashboard knobs. Only one row ever
 * exists; `current()` creates it with the column defaults on first read.
 */
class PortalSetting extends Model
{
    protected $fillable = [
        'trending_enabled', 'trending_metric', 'trending_window_months',
        'trending_limit', 'trending_min_events',
    ];

    protected function casts(): array
    {
        return [
            'trending_enabled' => 'boolean',
            'trending_window_months' => 'integer',
            'trending_limit' => 'integer',
            'trending_min_events' => 'integer',
        ];
    }

    public static function current(): self
    {
        return static::query()->oldest('id')->first() ?? static::create([]);
    }

    /** The Trending Content ranking rules, as the CMS edits them. */
    public function trendingToWire(): array
    {
        return [
            'enabled' => (bool) $this->trending_enabled,
            'metric' => $this->trending_metric,
            'windowMonths' => (int) $this->trending_window_months,
            'limit' => (int) $this->trending_limit,
            'minEvents' => (int) $this->trending_min_events,
        ];
    }
}
