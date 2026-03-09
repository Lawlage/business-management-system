<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use App\Models\GlobalAuditLog;
use App\Services\AuditLogger;
use App\Enums\TenantRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SuperAdminTenantController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse(Tenant::query()->orderBy('created_at', 'desc')->get());
    }

    public function auditLogs(): JsonResponse
    {
        return new JsonResponse(GlobalAuditLog::query()->latest()->limit(300)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:64', 'alpha_dash', 'unique:tenants,slug'],
        ]);

        $tenant = Tenant::query()->create([
            'id' => (string) Str::uuid(),
            'name' => $payload['name'],
            'slug' => $payload['slug'],
            'status' => 'active',
            'created_by' => $request->user()?->id,
            'data' => [],
        ]);

        $this->auditLogger->global($request, 'tenant.created', $request->user(), $tenant->id, [
            'entity_type' => 'tenant',
            'entity_id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
        ]);

        return new JsonResponse($tenant, 201);
    }

    public function destroy(Request $request, string $tenantId): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($tenantId);
        $tenant->delete();

        $this->auditLogger->global($request, 'tenant.deleted', $request->user(), $tenantId, [
            'entity_type' => 'tenant',
            'entity_id' => $tenantId,
        ]);

        return new JsonResponse(['message' => 'Tenant deleted.']);
    }

    public function suspend(Request $request, string $tenantId): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail($tenantId);
        $tenant->update([
            'status' => 'suspended',
            'suspended_at' => now(),
        ]);

        $this->auditLogger->global($request, 'tenant.suspended', $request->user(), $tenantId, [
            'entity_type' => 'tenant',
            'entity_id' => $tenantId,
        ]);

        return new JsonResponse(['message' => 'Tenant suspended.']);
    }

    public function assignTenantAdmin(Request $request, string $tenantId): JsonResponse
    {
        $payload = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = User::query()->findOrFail($payload['user_id']);

        TenantMembership::query()->updateOrCreate(
            ['tenant_id' => $tenantId, 'user_id' => $user->id],
            ['role' => TenantRole::TenantAdmin->value, 'can_edit' => true],
        );

        $this->auditLogger->global($request, 'tenant.admin_assigned', $request->user(), $tenantId, [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse(['message' => 'Tenant admin assigned.']);
    }
}
