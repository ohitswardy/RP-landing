<?php

namespace App\Models;

use App\Support\ServiceDefaults;
use Illuminate\Database\Eloquent\Model;

/**
 * Singleton record for the /services landing page. Only one row ever
 * exists; `current()` creates it from the seed defaults on first read.
 */
class ServicePage extends Model
{
    protected $fillable = ['eyebrow', 'title', 'dek', 'hero_image', 'card_cta'];

    public static function current(): self
    {
        return static::query()->oldest('id')->first()
            ?? static::create(ServiceDefaults::page());
    }

    public function toWire(): array
    {
        return [
            'eyebrow' => (string) $this->eyebrow,
            'title' => $this->title,
            'dek' => (string) $this->dek,
            'heroImage' => (string) $this->hero_image,
            'cardCta' => (string) $this->card_cta,
        ];
    }
}
