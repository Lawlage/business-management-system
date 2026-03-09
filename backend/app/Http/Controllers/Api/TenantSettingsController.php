<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TenantSettingsController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $tenant = Tenant::query()->findOrFail($tenantId);

        return new JsonResponse([
            'timezone' => data_get($tenant->data ?? [], 'timezone', 'UTC'),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $tenant = Tenant::query()->findOrFail($tenantId);

        $payload = $request->validate([
            'timezone' => ['required', 'string', Rule::in(timezone_identifiers_list())],
        ]);

        $data = $tenant->data ?? [];
        $data['timezone'] = $payload['timezone'];

        $tenant->update(['data' => $data]);

        $this->auditLogger->global($request, 'tenant.settings_updated', $request->user(), $tenantId, [
            'entity_type' => 'tenant',
            'entity_id' => $tenantId,
            'timezone' => $payload['timezone'],
        ]);

        return new JsonResponse(['timezone' => $payload['timezone']]);
    }
}
