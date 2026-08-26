<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalToken;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public, unauthenticated endpoints behind the one-time links a client
 * receives by email: complete a registration, or reset a password.
 */
class RegistrationController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $record = $this->resolve($token, PortalToken::REGISTRATION);
        if (! $record instanceof PortalToken) {
            return $record;
        }

        $client = $record->user;

        return response()->json([
            'client' => [
                'name' => $client->name,
                'email' => $client->email,
                'username' => $client->username,
                'firm' => $client->firm,
                'position' => $client->position,
                'phone' => $client->phone,
            ],
            'expiresAt' => $record->expires_at->toIso8601String(),
            // A client who already registered should not fill the form twice.
            'alreadySubmitted' => $client->status !== User::STATUS_INVITED,
        ]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $record = $this->resolve($token, PortalToken::REGISTRATION);
        if (! $record instanceof PortalToken) {
            return $record;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'firm' => ['required', 'string', 'max:120'],
            'position' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed'],
        ], [
            'password.confirmed' => 'The two passwords do not match.',
        ]);

        $client = $record->user;
        $client->forceFill([
            'name' => $data['name'],
            'firm' => $data['firm'],
            'position' => $data['position'] ?? null,
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'status' => User::STATUS_PENDING,
            'registered_at' => now(),
        ])->save();

        $record->forceFill(['used_at' => now()])->save();

        Audit::log('Completed registration', $client->email, $client->name);

        return response()->json([
            'ok' => true,
            'status' => User::STATUS_PENDING,
            'client' => ['name' => $client->name, 'username' => $client->username, 'email' => $client->email],
        ]);
    }

    public function showReset(string $token): JsonResponse
    {
        $record = $this->resolve($token, PortalToken::PASSWORD_RESET);
        if (! $record instanceof PortalToken) {
            return $record;
        }

        $client = $record->user;

        return response()->json([
            'client' => [
                'name' => $client->name,
                'email' => $client->email,
                'username' => $client->username,
            ],
            'expiresAt' => $record->expires_at->toIso8601String(),
        ]);
    }

    public function submitReset(Request $request, string $token): JsonResponse
    {
        $record = $this->resolve($token, PortalToken::PASSWORD_RESET);
        if (! $record instanceof PortalToken) {
            return $record;
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed'],
        ], [
            'password.confirmed' => 'The two passwords do not match.',
        ]);

        $client = $record->user;
        $client->forceFill(['password' => $data['password']])->save();
        // Sign every existing session out; the password just changed.
        $client->tokens()->delete();

        $record->forceFill(['used_at' => now()])->save();

        Audit::log('Reset own password', $client->email, $client->name);

        return response()->json(['ok' => true]);
    }

    /** Resolve a live token, or the JSON response explaining why it is dead. */
    private function resolve(string $token, string $purpose): PortalToken|JsonResponse
    {
        $record = PortalToken::with('user')->where('token', $token)->where('purpose', $purpose)->first();

        if (! $record || ! $record->user) {
            return response()->json(['message' => 'This link is not valid. Ask your Regis coverage for a new one.'], 404);
        }
        if ($record->used_at !== null) {
            return response()->json(['message' => 'This link has already been used. Ask your Regis coverage for a new one.'], 410);
        }
        if ($record->expires_at->isPast()) {
            return response()->json(['message' => 'This link has expired. Ask your Regis coverage for a new one.'], 410);
        }

        return $record;
    }
}
