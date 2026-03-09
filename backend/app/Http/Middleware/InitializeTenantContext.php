<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\TenantAccessService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use function tenancy;

class InitializeTenantContext
{
    public function __construct(private readonly TenantAccessService $tenantAccessService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = (string) ($request->header('X-Tenant-Id') ?? $request->route('tenantId'));

        if ($tenantId === '') {
            return new JsonResponse(['message' => 'Tenant context is required.'], 422);
        }

        $tenant = Tenant::query()->find($tenantId);

        if (! $tenant || $tenant->status !== 'active') {
            return new JsonResponse(['message' => 'Tenant is unavailable.'], 404);
        }

        $user = $request->user();
        $breakGlassToken = $request->header('X-Break-Glass-Token');

        if (! $user || ! $this->tenantAccessService->hasTenantAccess($user, $tenantId, $breakGlassToken)) {
            return new JsonResponse(['message' => 'Tenant access denied.'], 403);
        }

        tenancy()->initialize($tenant);
        $request->attributes->set('tenant_id', $tenantId);

        try {
            return $next($request);
        } finally {
            tenancy()->end();
        }
    }
}
