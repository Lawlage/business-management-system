<?php

namespace App\Http\Controllers\Api;

use App\Enums\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\TenantMembership;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique($centralConnection . '.users', 'email')],
            'password' => ['required', 'string', 'min:12', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/'],
            'role' => ['required', 'in:' . $roles],
        ]);

        $user = DB::transaction(function () use ($payload, $tenantId): User {
            $user = User::query()->create([
                'first_name' => $payload['first_name'],
                'last_name' => $payload['last_name'],
                'email' => $payload['email'],
                'password' => Hash::make($payload['password']),
            ]);

            TenantMembership::query()->create([
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'role' => $payload['role'],
                'can_edit' => true,
            ]);

            return $user;
        });

        $this->auditLogger->tenant($request, 'tenant.user_created', $request->user(), [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
            'entity_title' => $user->name,
            'email' => $user->email,
            'role' => $payload['role'],
        ]);

        return new JsonResponse($user->only(['id', 'first_name', 'last_name', 'email']), 201);
    }

    public function destroy(Request $request, int $userId): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        if ((int) $request->user()?->id === $userId) {
            return new JsonResponse(['message' => 'You cannot delete your own account.'], 422);
        }

        $deleted = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->delete();

        if (! $deleted) {
            return new JsonResponse(['message' => 'User not found in this tenant.'], 404);
        }

        $removedUser = User::query()->find($userId);
        $this->auditLogger->tenant($request, 'tenant.user_removed', $request->user(), [
            'entity_type' => 'user',
            'entity_id' => (string) $userId,
            'entity_title' => $removedUser?->name,
        ]);

        return new JsonResponse(['message' => 'User removed from tenant.']);
    }

    public function resetPassword(Request $request, int $userId): JsonResponse
    {
        $tenantId = (string) $request->attributes->get('tenant_id');

        $payload = $request->validate([
            'password' => ['required', 'string', 'min:12', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/'],
        ]);

        // Verify the target user belongs to this tenant before allowing password reset.
        $membership = TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->firstOrFail();

        $user = User::query()->findOrFail($membership->user_id);
        $user->update(['password' => Hash::make($payload['password'])]);

        $this->auditLogger->tenant($request, 'tenant.user_password_reset', $request->user(), [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse(['message' => 'Password reset.']);
    }

    public function updateMembership(Request $request, int $userId): JsonResponse
    {
        if ((int) $request->user()?->id === $userId) {
            return new JsonResponse(['message' => 'You cannot change your own access level.'], 403);
        }

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

        $targetUser = User::query()->findOrFail($userId);

        $changes = [];
        if (isset($payload['role']) && $payload['role'] !== $membership->role) {
            $changes['role_from'] = $membership->role;
            $changes['role_to'] = $payload['role'];
        }
        if (isset($payload['can_edit']) && $payload['can_edit'] !== $membership->can_edit) {
            $changes['can_edit_from'] = $membership->can_edit ? 'true' : 'false';
            $changes['can_edit_to'] = $payload['can_edit'] ? 'true' : 'false';
        }

        $membership->update(array_filter($payload, fn ($value) => $value !== null));

        $this->auditLogger->tenant($request, 'tenant.membership_updated', $request->user(), array_merge([
            'entity_type' => 'user',
            'entity_id' => (string) $targetUser->id,
            'entity_title' => $targetUser->name,
            'email' => $targetUser->email,
        ], $changes));

        return new JsonResponse($membership);
    }
}
