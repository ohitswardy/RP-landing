<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Subscriber extends Model
{
    /** Where a subscriber came from: typed in by staff, or the public site's form. */
    public const SOURCE_CMS = 'cms';

    public const SOURCE_PUBLIC = 'public';

    protected $fillable = [
        'email', 'firm', 'joined', 'source', 'verified', 'verify_token', 'verified_at',
        'unsubscribe_token', 'unsubscribed_at',
    ];

    protected function casts(): array
    {
        return [
            'joined' => 'date:Y-m-d',
            'verified' => 'boolean',
            'verified_at' => 'datetime',
            'unsubscribed_at' => 'datetime',
        ];
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

    /** Mint (or re-mint) the confirmation token the public subscribe flow emails out. */
    public function issueVerifyToken(): string
    {
        $this->forceFill(['verify_token' => Str::random(48)])->save();

        return $this->verify_token;
    }

    /** The confirmation link on the public site: {FRONTEND_URL}/newsletter/verify/{token}. */
    public function verifyUrl(): string
    {
        $token = $this->verify_token ?: $this->issueVerifyToken();

        return rtrim((string) config('app.frontend_url'), '/').'/newsletter/verify/'.$token;
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
            'verifiedAt' => $this->verified_at?->toIso8601String(),
            'unsubscribedAt' => $this->unsubscribed_at?->toIso8601String(),
        ];
    }
}
