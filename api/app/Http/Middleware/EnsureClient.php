<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\AccountGate;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every portal call re-checks the account against the same rules as sign-in,
 * so an approval that is withdrawn, a suspension, or a decline takes effect
 * on the client's very next request rather than at their next login.
 */
class EnsureClient
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user || ! $user->isClient()) {
            return response()->json(['message' => 'This endpoint is limited to portal clients.'], 403);
        }

        if ($message = AccountGate::clientBlock($user)) {
            return response()->json(['message' => $message], 403);
        }

        if (! $user->last_active_at || $user->last_active_at->lt(now()->subMinute())) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        return $next($request);
    }
}
