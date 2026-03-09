<?php

namespace App\Http\Middleware;

use App\Services\TenantAccessService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireTenantPermission
{
    public function __construct(private readonly TenantAccessService $tenantAccessService)
    {
    }

    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $token = $request->header('X-Break-Glass-Token');

        if ($tenantId === '' || ! $request->user() || ! $this->tenantAccessService->hasPermission($request->user(), $tenantId, $permission, $token)) {
            return new JsonResponse(['message' => 'Permission denied.'], 403);
        }

        return $next($request);
    }
}
