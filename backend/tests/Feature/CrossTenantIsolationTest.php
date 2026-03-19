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

    public function test_user_cannot_access_another_tenants_renewals(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $response = $this->actingAs($adminA)->getJson('/api/renewals', [
            'X-Tenant-Id' => $tenantB->id,
        ]);

        $response->assertForbidden();
    }

    public function test_renewal_created_in_tenant_a_is_not_visible_in_tenant_b(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $clientId = $this->createClient($adminA, $tenantA);

        // AdminA creates a renewal in tenantA.
        $this->actingAs($adminA)->postJson('/api/renewals', [
            'title' => 'Tenant A Exclusive',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenantA));

        // AdminB lists renewals in tenantB — should be empty.
        $response = $this->actingAs($adminB)->getJson('/api/renewals', $this->tenantHeaders($tenantB));

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

        $response = $this->actingAs($admin)->getJson('/api/renewals', $this->tenantHeaders($tenant));

        $response->assertNotFound();
    }
}
