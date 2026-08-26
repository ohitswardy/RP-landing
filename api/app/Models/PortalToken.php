<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PortalToken extends Model
{
    public const REGISTRATION = 'registration';
    public const PASSWORD_RESET = 'password_reset';

    protected $fillable = ['user_id', 'token', 'purpose', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Issue a fresh link, retiring any unused link of the same purpose. */
    public static function issue(User $user, string $purpose, int $days = 14): self
    {
        static::where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        return static::create([
            'user_id' => $user->id,
            'token' => Str::random(48),
            'purpose' => $purpose,
            'expires_at' => now()->addDays($days),
        ]);
    }

    public function isSpent(): bool
    {
        return $this->used_at !== null || $this->expires_at->isPast();
    }

    /** The address the client opens to finish the flow. */
    public function url(): string
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        $path = $this->purpose === self::REGISTRATION ? 'register' : 'reset';

        return "{$base}/portal/{$path}/{$this->token}";
    }
}
