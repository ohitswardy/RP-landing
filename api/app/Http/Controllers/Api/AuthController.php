<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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
        ]);

        $user = User::with('role.permissions')
            ->where('email', mb_strtolower($data['email']))
            ->where('kind', User::KIND_STAFF)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Credentials not recognized. Check the address and password issued to you.'], 422);
        }

        if ($user->suspended) {
            return response()->json(['message' => 'This account is suspended. Contact systems administration.'], 403);
        }

        $user->forceFill(['last_active_at' => now()])->saveQuietly();
        $token = $user->createToken('cms', ['cms'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->staffWire($user),
        ]);
    }

    public function portalLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Clients sign in with the Regis-issued user id or their email.
            'identity' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $identity = mb_strtolower(trim($data['identity']));
        $user = User::where('kind', User::KIND_CLIENT)
            ->where(fn ($q) => $q->where('email', $identity)->orWhere('username', $identity))
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Credentials not recognized. Use the user id and password issued with your mandate.'], 422);
        }

        if ($message = $this->onboardingBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        if ($user->suspended) {
            return response()->json(['message' => 'Portal access for this mandate is suspended. Contact your Regis coverage.'], 403);
        }

        $user->forceFill(['last_active_at' => now()])->saveQuietly();
        $token = $user->createToken('portal', ['portal'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'client' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'firm' => $user->firm ?? 'Institutional client',
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->isStaff()) {
            $user->load('role.permissions');

            return response()->json(['user' => $this->staffWire($user)]);
        }

        return response()->json(['client' => [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'firm' => $user->firm ?? 'Institutional client',
        ]]);
    }

    /** Why an otherwise valid client cannot sign in yet, or null when they can. */
    private function onboardingBlock(User $user): ?string
    {
        return match ($user->status) {
            User::STATUS_INVITED => 'Your registration is not complete. Open the link in your welcome email to create your password.',
            User::STATUS_PENDING => 'Your registration is with us for review. You will receive an email once it is approved.',
            User::STATUS_DECLINED => 'This application was not approved. Contact your Regis coverage for help.',
            default => null,
        };
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
        ];
    }
}
