<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AccountGate;
use App\Support\SuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function cmsLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
            // "Remember me": the token lives 30 days instead of dying with the tab.
            'remember' => ['sometimes', 'boolean'],
        ]);

        $user = User::with('role.permissions')
            ->where('email', mb_strtolower($data['email']))
            ->where('kind', User::KIND_STAFF)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Credentials not recognized. Check the address and password issued to you.'], 422);
        }

        if ($message = AccountGate::staffBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        $user->forceFill(['last_active_at' => now()])->saveQuietly();
        $session = $user->issueSessionToken('cms', ['cms'], (bool) ($data['remember'] ?? false));

        return response()->json([
            'token' => $session['token'],
            'expiresAt' => $session['expiresAt'],
            'user' => $this->staffWire($user),
        ]);
    }

    public function portalLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Clients sign in with the Regis-issued user id or their email.
            'identity' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string', 'min:8'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $user = self::findClient($data['identity']);

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Credentials not recognized. Use the user id and password issued with your mandate.'], 422);
        }

        if ($message = AccountGate::clientBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        $user->forceFill(['last_active_at' => now()])->saveQuietly();
        $session = $user->issueSessionToken('portal', ['portal'], (bool) ($data['remember'] ?? false));

        return response()->json([
            'token' => $session['token'],
            'expiresAt' => $session['expiresAt'],
            'client' => $user->toClientSessionWire(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * The signed-in account, in the same shape its login returned, so a
     * shell can refresh the session (permissions, role, profile) on boot.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->isStaff()) {
            if ($message = AccountGate::staffBlock($user)) {
                return response()->json(['message' => $message], 403);
            }
            $user->load('role.permissions');

            return response()->json(['kind' => User::KIND_STAFF, 'user' => $this->staffWire($user)]);
        }

        if ($message = AccountGate::clientBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        return response()->json(['kind' => User::KIND_CLIENT, 'client' => $user->toClientSessionWire()]);
    }

    /**
     * A portal client by Regis-issued user id or email. Both halves match
     * case-insensitively so an id typed as "rp-demo-0001" still lands.
     */
    public static function findClient(string $identity): ?User
    {
        $identity = mb_strtolower(trim($identity));
        if ($identity === '') {
            return null;
        }

        return User::where('kind', User::KIND_CLIENT)
            ->where(fn ($q) => $q->where('email', $identity)->orWhereRaw('LOWER(username) = ?', [$identity]))
            ->first();
    }

    private function staffWire(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role?->name ?? 'Staff',
            'permissions' => $user->permissionKeys(),
            // The Outlook account this staff member blasts from (Email desk).
            'outlookEmail' => $user->outlook_email,
            // Unlocks the password readout in Users & access.
            'superAdmin' => SuperAdmin::is($user),
        ];
    }
}
