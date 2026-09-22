<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * What a signed-in account can do to itself: read its own profile and
 * change its own password. Mounted twice — under /portal for clients and
 * under /cms for staff — with the audience middleware doing the gating.
 */
class SelfServiceController extends Controller
{
    /** GET /api/portal/profile — the client's identity and mandate. */
    public function profile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['profile' => $user->toProfileWire()]);
    }

    /**
     * PUT /api/portal/password, PUT /api/cms/password
     * {current, password, password_confirmation}. Verifies the current
     * password, stores the new one (hash plus the super-admin-readable copy,
     * through the model mutator), and signs out every other session while
     * keeping this one.
     */
    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'current' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed', 'different:current'],
        ], [
            'password.confirmed' => 'The two new passwords do not match.',
            'password.different' => 'Choose a password different from the current one.',
        ]);

        if (! Hash::check($data['current'], $user->password)) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors' => ['current' => ['The current password is incorrect.']],
            ], 422);
        }

        $user->forceFill(['password' => $data['password']])->save();
        $user->revokeOtherTokens();

        $audit = Audit::log('Changed own password', $user->email, $user->name);

        return response()->json(['ok' => true, 'audit' => $audit->toWire()]);
    }
}
