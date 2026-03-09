<?php

namespace App\Http\Controllers\Api;

use App\Enums\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\TenantMembership;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class TenantUserController extends Controller
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        $memberships = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->with('user')
            ->get();

        return new JsonResponse($memberships);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $roles = implode(',', array_map(fn (TenantRole $role): string => $role->value, TenantRole::cases()));
        $centralConnection = (string) config('tenancy.database.central_connection', config('database.default'));

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique($centralConnection . '.users', 'email')],
            'password' => ['required', 'string', 'min:12'],
            'role' => ['required', 'in:' . $roles],
        ]);

        $user = User::query()->create([
            'name' => $payload['name'],
            'email' => $payload['email'],
            'password' => Hash::make($payload['password']),
        ]);

        TenantMembership::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => $payload['role'],
            'can_edit' => true,
        ]);

        $this->auditLogger->global($request, 'tenant.user_created', $request->user(), $tenantId, [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse($user, 201);
    }

    public function destroy(Request $request, int $userId): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        if ((int) $request->user()?->id === $userId) {
            return new JsonResponse(['message' => 'You cannot delete your own account.'], 422);
        }

        TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->delete();

        $this->auditLogger->global($request, 'tenant.user_removed', $request->user(), $tenantId, [
            'entity_type' => 'user',
            'entity_id' => (string) $userId,
        ]);

        return new JsonResponse(['message' => 'User removed from tenant.']);
    }

    public function resetPassword(Request $request, int $userId): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        $payload = $request->validate([
            'password' => ['required', 'string', 'min:12'],
        ]);

        $user = User::query()->findOrFail($userId);
        $user->update(['password' => Hash::make($payload['password'])]);

        $this->auditLogger->global($request, 'tenant.user_password_reset', $request->user(), $tenantId, [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse(['message' => 'Password reset.']);
    }

    public function updateMembership(Request $request, int $userId): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');
        $roles = implode(',', array_map(fn (TenantRole $role): string => $role->value, TenantRole::cases()));

        $payload = $request->validate([
            'role' => ['nullable', 'in:' . $roles],
            'can_edit' => ['nullable', 'boolean'],
        ]);

        $membership = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->firstOrFail();

        $membership->update(array_filter($payload, fn ($value) => $value !== null));

        $this->auditLogger->global($request, 'tenant.membership_updated', $request->user(), $tenantId, [
            'entity_type' => 'tenant_membership',
            'entity_id' => (string) $membership->id,
        ]);

        return new JsonResponse($membership);
    }
}
