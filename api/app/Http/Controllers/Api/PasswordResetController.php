<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalToken;
use App\Models\User;
use App\Support\AccountGate;
use App\Support\Audit;
use App\Support\PasswordResetMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Self-service "forgot password" for both doors. Both endpoints are public,
 * throttled, and answer the same neutral 200 whether or not the account
 * exists, so they cannot be used to enumerate accounts. When an account
 * matches and may reset, a single-use link goes out by email; the existing
 * GET/POST /api/portal/reset/{token} endpoints finish the flow for clients
 * and staff alike.
 */
class PasswordResetController extends Controller
{
    private const NEUTRAL = 'If an account matches, a link to reset your password is on its way to its email address.';

    public function __construct(private readonly PasswordResetMail $mail) {}

    /** POST /api/portal/forgot-password {identity} — a client, by user id or email. */
    public function forgotClient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identity' => ['required', 'string', 'max:190'],
        ]);

        $user = AuthController::findClient($data['identity']);
        if ($user && $user->status === User::STATUS_INVITED && ! $user->suspended) {
            // No password exists yet: re-send the registration link instead,
            // which is what a client who lost the welcome email actually needs.
            $this->issue($user, PortalToken::REGISTRATION);
        } elseif ($user && AccountGate::canResetPassword($user)) {
            $this->issue($user, PortalToken::PASSWORD_RESET);
        }

        return response()->json(['ok' => true, 'message' => self::NEUTRAL]);
    }

    /** POST /api/cms/forgot-password {email} — a staff account. */
    public function forgotStaff(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        $user = User::where('kind', User::KIND_STAFF)
            ->where('email', mb_strtolower(trim($data['email'])))
            ->first();

        if ($user && AccountGate::canResetPassword($user)) {
            $this->issue($user, PortalToken::PASSWORD_RESET);
        }

        return response()->json(['ok' => true, 'message' => self::NEUTRAL]);
    }

    private function issue(User $user, string $purpose): void
    {
        // Reset links are short-lived; a lost registration link keeps the usual 14 days.
        $token = PortalToken::issue($user, $purpose, $purpose === PortalToken::PASSWORD_RESET ? 1 : 14);
        $token->setRelation('user', $user);

        Audit::log(
            $purpose === PortalToken::REGISTRATION ? 'Requested registration link' : 'Requested password reset',
            $user->email,
            $user->name,
        );

        $this->mail->send($user, $token);
    }
}
