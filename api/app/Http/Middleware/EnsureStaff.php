<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user || ! $user->isStaff()) {
            return response()->json(['message' => 'This endpoint is limited to Regis staff accounts.'], 403);
        }

        if ($user->suspended) {
            return response()->json(['message' => 'This account is suspended. Contact systems administration.'], 403);
        }

        // Keep last-active fresh without writing on every request.
        if (! $user->last_active_at || $user->last_active_at->lt(now()->subMinute())) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        return $next($request);
    }
}
