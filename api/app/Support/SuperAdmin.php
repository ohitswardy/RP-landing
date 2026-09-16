<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;

/**
 * The one account that must always exist and always hold the Administrator
 * role: the CWDevs super admin. Seeded on a fresh install and re-asserted by
 * the legacy account import, so a `--fresh` import can never lock the CMS.
 */
class SuperAdmin
{
    public const EMAIL = 'superadmin@cwdevs.com';

    public const NAME = 'CWDevs Super Admin';

    /** The super admin, and only the super admin, can read account passwords back. */
    public static function is(?User $user): bool
    {
        return $user !== null && $user->isStaff() && mb_strtolower((string) $user->email) === self::EMAIL;
    }

    public static function password(): string
    {
        return (string) (env('SUPER_ADMIN_PASSWORD') ?: 'CWDevs2021!');
    }

    /** Create or repair the account. Never touches an existing password unless $resetPassword. */
    public static function ensure(bool $resetPassword = false): User
    {
        $admin = Role::where('is_system', true)->orderBy('id')->firstOrFail();

        $user = User::firstOrNew(['email' => self::EMAIL, 'kind' => User::KIND_STAFF]);
        $fresh = ! $user->exists;

        $user->fill([
            'name' => self::NAME,
            'kind' => User::KIND_STAFF,
            'status' => User::STATUS_APPROVED,
            'role_id' => $admin->id,
            'firm' => null,
            'suspended' => false,
        ]);
        if ($fresh || $resetPassword) {
            $user->password = self::password();
        }
        $user->save();

        return $user;
    }
}
