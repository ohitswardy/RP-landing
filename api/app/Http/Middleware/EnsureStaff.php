<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\AccountGate;
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

        // Re-checked on every request, so a suspension ends live sessions at once.
        if ($message = AccountGate::staffBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        // Keep last-active fresh without writing on every request.
        if (! $user->last_active_at || $user->last_active_at->lt(now()->subMinute())) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        return $next($request);
    }
}
