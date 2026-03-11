<?php

namespace Tests;

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

trait CreatesTenantContext
{
    /**
     * Create a tenant admin user bound to a provisioned tenant.
     *
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantAdminContext(): array
    {
        $user = User::query()->create([
            'name' => 'Tenant Admin',
            'email' => 'tenant-admin-' . Str::random(6) . '@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => false,
        ]);

        $tenant = Tenant::query()->create([
            'id' => (string) Str::uuid(),
            'name' => 'Test Tenant',
            'slug' => 'test-' . Str::lower(Str::random(5)),
            'status' => 'active',
            'data' => ['timezone' => 'Pacific/Auckland'],
        ]);

        TenantMembership::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => TenantRole::TenantAdmin->value,
            'can_edit' => true,
        ]);

        return [$user, $tenant];
    }

    /**
     * Create a standard user bound to an existing tenant.
     */
    protected function createTenantUser(string $tenantId, TenantRole $role = TenantRole::StandardUser, bool $canEdit = true): User
    {
        $user = User::query()->create([
            'name' => 'Tenant User',
            'email' => 'user-' . Str::random(6) . '@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => false,
        ]);

        TenantMembership::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => $role->value,
            'can_edit' => $canEdit,
        ]);

        return $user;
    }

    /**
     * Return the X-Tenant-Id header array for a given tenant.
     *
     * @return array<string, string>
     */
    protected function tenantHeaders(Tenant $tenant): array
    {
        return ['X-Tenant-Id' => $tenant->id];
    }
}
