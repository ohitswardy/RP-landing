<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user || ! $user->hasPermission($permission)) {
            return response()->json(['message' => 'Your role does not include access to this module.'], 403);
        }

        return $next($request);
    }
}
