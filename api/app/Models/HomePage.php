<?php

namespace App\Models;

use App\Support\HomeDefaults;
use Illuminate\Database\Eloquent\Model;

/**
 * Singleton record for the landing page copy. Only one row ever exists;
 * `current()` creates it from the seed defaults on first read.
 */
class HomePage extends Model
{
    protected $fillable = ['content'];

    protected function casts(): array
    {
        return ['content' => 'array'];
    }

    public static function current(): self
    {
        return static::query()->oldest('id')->first()
            ?? static::create(['content' => HomeDefaults::content()]);
    }

    public function toWire(): array
    {
        // Fallback down to the key: a row saved before a section — or before
        // a single field within one — still returns the whole document the
        // page expects. Lists are replaced wholesale, never merged item-wise.
        $defaults = HomeDefaults::content();
        $content = $this->content ?? [];

        $out = [];
        foreach ($defaults as $section => $value) {
            $stored = $content[$section] ?? null;
            $out[$section] = is_array($stored) ? array_merge($value, $stored) : $value;
        }

        return $out;
    }
}
