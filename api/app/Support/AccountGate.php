<?php

namespace App\Support;

use App\Models\User;

/**
 * The one place that decides whether an account may be on the system right
 * now, with the copy the user sees. Login and the per-request middleware
 * both read from here, so a client whose status changes mid-session is
 * refused on their next call with the same message they would see at the
 * door.
 */
class AccountGate
{
    public const CLIENT_SUSPENDED = 'Portal access for this mandate is suspended. Contact your Regis coverage.';

    public const STAFF_SUSPENDED = 'This account is suspended. Contact systems administration.';

    /** Why a portal client cannot be signed in, or null when they may. */
    public static function clientBlock(User $user): ?string
    {
        if ($user->suspended) {
            return self::CLIENT_SUSPENDED;
        }

        return match ($user->status) {
            User::STATUS_INVITED => 'Your registration is not complete. Open the link in your welcome email to create your password.',
            User::STATUS_PENDING => 'Your registration is with us for review. You will receive an email once it is approved.',
            User::STATUS_DECLINED => 'This application was not approved. Contact your Regis coverage for help.',
            User::STATUS_APPROVED => null,
            default => 'This account cannot sign in. Contact your Regis coverage for help.',
        };
    }

    /** Why a staff member cannot be signed in, or null when they may. */
    public static function staffBlock(User $user): ?string
    {
        return $user->suspended ? self::STAFF_SUSPENDED : null;
    }

    /** True when the account may receive a self-service password reset link. */
    public static function canResetPassword(User $user): bool
    {
        if ($user->suspended) {
            return false;
        }

        return $user->isStaff() || in_array($user->status, [User::STATUS_APPROVED, User::STATUS_PENDING], true);
    }
}
