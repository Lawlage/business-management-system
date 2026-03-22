<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

/**
 * Verify that users cannot read or modify data belonging to a different tenant.
 */
class CrossTenantIsolationTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    public function test_user_cannot_access_another_tenants_dashboard(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        // AdminA tries to hit the dashboard with tenantB's ID — access denied.
        $response = $this->actingAs($adminA)->getJson('/api/dashboard', [
            'X-Tenant-Id' => $tenantB->id,
        ]);

        $response->assertForbidden();
    }

    public function test_user_cannot_access_another_tenants_renewables(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $response = $this->actingAs($adminA)->getJson('/api/client-services', [
            'X-Tenant-Id' => $tenantB->id,
        ]);

        $response->assertForbidden();
    }

    public function test_renewable_created_in_tenant_a_is_not_visible_in_tenant_b(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $clientId = $this->createClient($adminA, $tenantA);

        $product = $this->actingAs($adminA)->postJson('/api/products', [
            'name' => 'Tenant A Product',
        ], $this->tenantHeaders($tenantA))->json();

        // AdminA creates a renewable in tenantA.
        $this->actingAs($adminA)->postJson('/api/client-services', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
        ], $this->tenantHeaders($tenantA));

        // AdminB lists renewables in tenantB — should be empty.
        $response = $this->actingAs($adminB)->getJson('/api/client-services', $this->tenantHeaders($tenantB));

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_inventory_created_in_tenant_a_is_not_visible_in_tenant_b(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $this->actingAs($adminA)->postJson('/api/inventory', [
            'name' => 'Tenant A Item',
            'sku' => 'TA-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenantA));

        $response = $this->actingAs($adminB)->getJson('/api/inventory', $this->tenantHeaders($tenantB));

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_custom_fields_are_isolated_per_tenant(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $this->actingAs($adminA)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Tenant A Field',
            'key' => 'tenant_a_field',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenantA));

        $response = $this->actingAs($adminB)->getJson('/api/custom-fields', $this->tenantHeaders($tenantB));

        $response->assertOk();
        $this->assertCount(0, $response->json());
    }

    public function test_suspended_tenant_is_inaccessible(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $tenant->update(['status' => 'suspended']);

        $response = $this->actingAs($admin)->getJson('/api/client-services', $this->tenantHeaders($tenant));

        $response->assertNotFound();
    }

    public function test_account_manager_must_belong_to_same_tenant(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();
        $foreignManager = $this->createAccountManager($tenantB->id);

        $response = $this->actingAs($adminA)->postJson('/api/clients', [
            'name' => 'Test Client',
            'account_manager_id' => $foreignManager->id,
        ], $this->tenantHeaders($tenantA));

        $response->assertUnprocessable();
    }
}
