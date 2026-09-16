<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const KIND_STAFF = 'staff';

    public const KIND_CLIENT = 'client';

    /** Portal onboarding states. Staff accounts are always approved. */
    public const STATUS_INVITED = 'invited';

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_DECLINED = 'declined';

    protected $fillable = [
        'name', 'email', 'username', 'password', 'kind', 'status', 'role_id',
        'firm', 'position', 'phone', 'suspended', 'last_active_at', 'registered_at', 'approved_at',
        'client_type', 'sector_prefs', 'preferred_analysts', 'outlook_email', 'legacy_meta',
    ];

    protected $hidden = ['password', 'password_recoverable', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_active_at' => 'datetime',
            'registered_at' => 'datetime',
            'approved_at' => 'datetime',
            'suspended' => 'boolean',
            'sector_prefs' => 'array',
            'preferred_analysts' => 'array',
            // What the legacy regis.ph export carried that has no column here.
            'legacy_meta' => 'array',
        ];
    }

    /**
     * A plaintext password is hashed for sign-in and, beside that, kept
     * encrypted under APP_KEY so the super admin can read it back. A value
     * that is already a hash (the legacy import, unusable placeholders) has no
     * plaintext to keep, so the recoverable copy is cleared.
     */
    protected function password(): Attribute
    {
        return Attribute::make(
            set: function (?string $value) {
                $hashed = $value === null || Hash::isHashed($value);

                return [
                    'password' => $hashed ? $value : Hash::make($value),
                    'password_recoverable' => $hashed ? null : Crypt::encryptString($value),
                ];
            },
        );
    }

    /** The current password, when it was set through this system; null otherwise. */
    public function revealPassword(): ?string
    {
        $sealed = $this->attributes['password_recoverable'] ?? null;

        return $sealed ? Crypt::decryptString($sealed) : null;
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function portalTokens(): HasMany
    {
        return $this->hasMany(PortalToken::class);
    }

    public function isStaff(): bool
    {
        return $this->kind === self::KIND_STAFF;
    }

    public function isClient(): bool
    {
        return $this->kind === self::KIND_CLIENT;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /** The client's mandate: the sectors and analyst bylines they are
        provisioned to read, lowercased and trimmed so matching survives the
        casing the desk happened to type. Empty lists on either side mean that
        half places no restriction. */
    public function coverage(): array
    {
        $clean = fn (?array $v) => array_values(array_unique(array_filter(
            array_map(fn ($x) => mb_strtolower(trim((string) $x)), $v ?? []),
            fn ($x) => $x !== '',
        )));

        return [
            'sectors' => $clean($this->sector_prefs),
            'analysts' => $clean($this->preferred_analysts),
        ];
    }

    /** True once a client is narrowed to preferred sectors or analysts;
        an unconfigured client keeps the whole catalog. */
    public function hasCoverageFilter(): bool
    {
        if (! $this->isClient()) {
            return false;
        }
        $c = $this->coverage();

        return $c['sectors'] !== [] || $c['analysts'] !== [];
    }

    /** Permission keys granted through the user's role. */
    public function permissionKeys(): array
    {
        if (! $this->isStaff() || ! $this->role) {
            return [];
        }

        return $this->role->permissions->pluck('key')->values()->all();
    }

    public function hasPermission(string $key): bool
    {
        return in_array($key, $this->permissionKeys(), true);
    }

    /** Account row as the CMS Users & access module consumes it. */
    public function toAccountWire(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'username' => $this->username,
            'kind' => $this->kind,
            'status' => $this->status,
            'role' => $this->role?->name,
            'roleId' => $this->role_id !== null ? (string) $this->role_id : null,
            'firm' => $this->firm,
            'position' => $this->position,
            'phone' => $this->phone,
            'clientType' => $this->client_type,
            'sectorPrefs' => $this->sector_prefs ?? [],
            'preferredAnalysts' => $this->preferred_analysts ?? [],
            'outlookEmail' => $this->outlook_email,
            'lastActive' => $this->last_active_at?->toIso8601String(),
            'registeredAt' => $this->registered_at?->toIso8601String(),
            'approvedAt' => $this->approved_at?->toIso8601String(),
            'suspended' => $this->suspended,
            'createdAt' => $this->created_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
