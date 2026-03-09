<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireGlobalSuperadmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_global_superadmin) {
            return new JsonResponse(['message' => 'Global superadmin role required.'], 403);
        }

        return $next($request);
    }
}
