<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Subscriber extends Model
{
    protected $fillable = ['email', 'firm', 'joined', 'source', 'verified', 'unsubscribe_token', 'unsubscribed_at'];

    protected function casts(): array
    {
        return ['joined' => 'date:Y-m-d', 'verified' => 'boolean', 'unsubscribed_at' => 'datetime'];
    }

    /**
     * The one-click opt-out link this subscriber's blasts carry. The token
     * is minted on first use and never rotates, so the link in an old issue
     * keeps working.
     */
    public function unsubscribeUrl(): string
    {
        if (! $this->unsubscribe_token) {
            $this->forceFill(['unsubscribe_token' => Str::random(48)])->save();
        }

        return rtrim((string) config('app.url'), '/').'/api/newsletter/unsubscribe/'.$this->unsubscribe_token;
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'firm' => $this->firm,
            'joined' => $this->joined->format('Y-m-d'),
            'source' => $this->source,
            'verified' => $this->verified,
            'unsubscribedAt' => $this->unsubscribed_at?->toIso8601String(),
        ];
    }
}
