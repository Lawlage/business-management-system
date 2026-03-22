<?php

namespace Tests\Feature;

use App\Models\TenantMembership;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class AccountManagerControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    public function test_any_tenant_member_can_list_account_managers(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $standardUser = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($standardUser)
            ->getJson('/api/account-managers', $this->tenantHeaders($tenant));

        $response->assertOk();
    }

    public function test_returns_only_is_account_manager_true_members(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $accountManager = $this->createAccountManager($tenant->id);
        $regularUser = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($admin)
            ->getJson('/api/account-managers', $this->tenantHeaders($tenant));

        $response->assertOk();
        $data = $response->json();

        $this->assertCount(1, $data);
        $this->assertEquals($accountManager->id, $data[0]['id']);
    }

    public function test_returns_correct_fields(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $accountManager = $this->createAccountManager($tenant->id);

        $response = $this->actingAs($admin)
            ->getJson('/api/account-managers', $this->tenantHeaders($tenant));

        $response->assertOk();
        $data = $response->json();

        $this->assertArrayHasKey('id', $data[0]);
        $this->assertArrayHasKey('first_name', $data[0]);
        $this->assertArrayHasKey('last_name', $data[0]);
        $this->assertArrayHasKey('name', $data[0]);
    }

    public function test_returns_empty_when_no_account_managers(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $this->createTenantUser($tenant->id);

        $response = $this->actingAs($admin)
            ->getJson('/api/account-managers', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJson([]);
    }

    public function test_cross_tenant_isolation(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();
        $this->createAccountManager($tenantA->id);

        // Tenant B's admin sees no account managers in their own tenant
        $response = $this->actingAs($adminB)
            ->getJson('/api/account-managers', $this->tenantHeaders($tenantB));

        $response->assertOk()->assertJson([]);
    }

    public function test_requires_authentication(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $this->getJson('/api/account-managers', $this->tenantHeaders($tenant))
            ->assertUnauthorized();
    }
}
