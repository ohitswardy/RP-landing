<?php

namespace App\Http\Controllers\Crms;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * The CRMS has no accounts of its own. This signs in the same CMS staff
 * account and refuses anything that does not hold crms.access — so an
 * Editor or a client gets a clear refusal on the CRMS door rather than an
 * empty workspace.
 */
class LoginController extends CrmsController
{
    public const ACCESS = 'crms.access';

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::with('role.permissions')
            ->where('email', mb_strtolower($data['email']))
            ->where('kind', User::KIND_STAFF)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Credentials not recognized. Check the desk address and password issued to you.'], 422);
        }
        if ($user->suspended) {
            return response()->json(['message' => 'This account is suspended. Contact systems administration.'], 403);
        }
        if (! $user->hasPermission(self::ACCESS)) {
            return response()->json(['message' => 'This account is not provisioned for the CRMS. Coverage, mandate and client records are limited to authorised desks.'], 403);
        }

        $user->forceFill(['last_active_at' => now()])->saveQuietly();
        // Same ability as the CMS token: one session covers both areas.
        $token = $user->createToken('crms', ['cms'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->name ?? 'Staff',
                'permissions' => $user->permissionKeys(),
                'outlookEmail' => $user->outlook_email,
            ],
        ]);
    }
}
