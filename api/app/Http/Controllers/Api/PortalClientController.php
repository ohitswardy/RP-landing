<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalToken;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin side of portal-client onboarding: provision an account, issue the
 * "create your password" link, approve or decline the completed registration,
 * and reset a password. Email bodies are composed in the CMS and copied out
 * by the administrator, so nothing is dispatched from here.
 */
class PortalClientController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'username' => ['nullable', 'string', 'max:60', 'alpha_dash', 'unique:users,username'],
            'firm' => ['required', 'string', 'max:120'],
        ], [
            'email.unique' => 'An account already exists for that address.',
            'username.unique' => 'That user id is taken.',
            'username.alpha_dash' => 'User ids use letters, numbers, dashes, and underscores only.',
        ]);

        $client = User::create([
            'name' => $data['name'],
            'email' => mb_strtolower($data['email']),
            'username' => $data['username'] ?: $this->deriveUsername($data['email']),
            // Placeholder until the client sets their own on the registration page.
            'password' => Str::random(40),
            'kind' => User::KIND_CLIENT,
            'status' => User::STATUS_INVITED,
            'firm' => $data['firm'],
            'suspended' => false,
        ]);

        $token = PortalToken::issue($client, PortalToken::REGISTRATION);
        $audit = Audit::log('Provisioned client access', $client->email);

        return response()->json([
            'item' => $client->toAccountWire(),
            'link' => $token->url(),
            'expiresAt' => $token->expires_at->toIso8601String(),
            'audit' => $audit->toWire(),
        ], 201);
    }

    /** Re-issue a registration link when the first one expired or went astray. */
    public function inviteLink(User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }
        if ($client->status === User::STATUS_APPROVED) {
            return response()->json(['message' => 'This client is already approved. Send a password reset instead.'], 422);
        }

        $token = PortalToken::issue($client, PortalToken::REGISTRATION);
        $audit = Audit::log('Re-issued registration link', $client->email);

        return response()->json([
            'item' => $client->toAccountWire(),
            'link' => $token->url(),
            'expiresAt' => $token->expires_at->toIso8601String(),
            'audit' => $audit->toWire(),
        ]);
    }

    public function approve(User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }
        if ($client->status === User::STATUS_INVITED) {
            return response()->json(['message' => 'This client has not completed their registration yet.'], 422);
        }

        $client->forceFill([
            'status' => User::STATUS_APPROVED,
            'approved_at' => now(),
            'suspended' => false,
        ])->save();

        $audit = Audit::log('Approved client account', $client->email);

        return response()->json(['item' => $client->toAccountWire(), 'audit' => $audit->toWire()]);
    }

    public function decline(User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }

        $client->forceFill(['status' => User::STATUS_DECLINED, 'approved_at' => null])->save();
        $client->tokens()->delete();

        $audit = Audit::log('Declined client account', $client->email);

        return response()->json(['item' => $client->toAccountWire(), 'audit' => $audit->toWire()]);
    }

    /** Issue a one-time password-reset link for an existing client. */
    public function resetLink(User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }

        $token = PortalToken::issue($client, PortalToken::PASSWORD_RESET);
        $audit = Audit::log('Issued password reset link', $client->email);

        return response()->json([
            'item' => $client->toAccountWire(),
            'link' => $token->url(),
            'expiresAt' => $token->expires_at->toIso8601String(),
            'audit' => $audit->toWire(),
        ]);
    }

    /** Set a client password directly, for clients who cannot use a link. */
    public function setPassword(Request $request, User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);

        $client->forceFill(['password' => $data['password']])->save();
        // Any live portal session for this client is invalidated by the change.
        $client->tokens()->delete();

        $audit = Audit::log('Reset client password', $client->email);

        return response()->json(['item' => $client->toAccountWire(), 'audit' => $audit->toWire()]);
    }

    /** Change the Regis-issued user id on a client account. */
    public function updateUsername(Request $request, User $client): JsonResponse
    {
        if ($error = $this->guardClient($client)) {
            return $error;
        }

        $data = $request->validate([
            'username' => ['required', 'string', 'max:60', 'alpha_dash', Rule::unique('users', 'username')->ignore($client->id)],
        ], [
            'username.unique' => 'That user id is taken.',
        ]);

        $client->forceFill(['username' => $data['username']])->save();
        $audit = Audit::log('Changed client user id', $client->email);

        return response()->json(['item' => $client->toAccountWire(), 'audit' => $audit->toWire()]);
    }

    private function guardClient(User $client): ?JsonResponse
    {
        return $client->isClient()
            ? null
            : response()->json(['message' => 'That account is not a portal client.'], 422);
    }

    /** "k.villaruel@arqcapital.ph" becomes "kvillaruel", uniquified if taken. */
    private function deriveUsername(string $email): string
    {
        $base = Str::of($email)->before('@')->replaceMatches('/[^A-Za-z0-9]/', '')->lower()->limit(24, '')->value();
        $base = $base !== '' ? $base : 'client';

        $candidate = $base;
        $n = 2;
        while (User::where('username', $candidate)->exists()) {
            $candidate = $base.$n;
            $n++;
        }

        return $candidate;
    }
}
