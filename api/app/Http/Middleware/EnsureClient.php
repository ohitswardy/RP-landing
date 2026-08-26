<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClient
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user || ! $user->isClient()) {
            return response()->json(['message' => 'This endpoint is limited to portal clients.'], 403);
        }

        if ($user->suspended) {
            return response()->json(['message' => 'Portal access for this mandate is suspended. Contact your Regis coverage.'], 403);
        }

        if (! $user->last_active_at || $user->last_active_at->lt(now()->subMinute())) {
            $user->forceFill(['last_active_at' => now()])->saveQuietly();
        }

        return $next($request);
    }
}
