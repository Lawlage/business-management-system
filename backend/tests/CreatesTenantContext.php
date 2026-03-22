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
    /** @var list<string> */
    private array $tenantIdsToCleanUp = [];

    /**
     * Delete provisioned tenant databases after each test so they don't accumulate.
     * Tenant creation fires stancl/tenancy events that provision real MySQL databases
     * outside the RefreshDatabase transaction — those must be cleaned up explicitly.
     */
    protected function tearDown(): void
    {
        foreach ($this->tenantIdsToCleanUp as $id) {
            $tenant = Tenant::query()->find($id);
            $tenant?->delete();
        }
        $this->tenantIdsToCleanUp = [];

        parent::tearDown();
    }

    /**
     * Create a tenant admin user bound to a provisioned tenant.
     *
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantAdminContext(): array
    {
        $user = User::query()->create([
            'first_name' => 'Tenant',
            'last_name' => 'Admin',
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

        $this->tenantIdsToCleanUp[] = $tenant->id;

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
            'first_name' => 'Tenant',
            'last_name' => 'User',
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

    /**
     * Create a tenant user flagged as an account manager and return that user.
     */
    protected function createAccountManager(string $tenantId, TenantRole $role = TenantRole::SubAdmin): User
    {
        $user = $this->createTenantUser($tenantId, $role);

        TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->update(['is_account_manager' => true]);

        return $user;
    }

    /**
     * Create a client via the API and return its id.
     */
    protected function createClient(User $user, Tenant $tenant, string $name = 'Test Client'): int
    {
        return (int) $this->actingAs($user)
            ->postJson('/api/clients', ['name' => $name], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json('id');
    }
}
