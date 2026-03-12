<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class InventoryControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_inventory(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/inventory', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page']);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_inventory_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Laptop Stand',
            'sku' => 'STD-001',
            'quantity_on_hand' => 10,
            'minimum_on_hand' => 2,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('name', 'Laptop Stand')
            ->assertJsonPath('sku', 'STD-001')
            ->assertJsonPath('quantity_on_hand', 10);
    }

    public function test_standard_user_cannot_create_inventory_item(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Test',
            'sku' => 'TST-001',
            'quantity_on_hand' => 1,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_create_inventory_requires_name_sku_and_quantities(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/inventory', [], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['name', 'sku', 'quantity_on_hand', 'minimum_on_hand']);
    }

    public function test_duplicate_sku_is_rejected(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Item One',
            'sku' => 'DUPE-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Item Two',
            'sku' => 'DUPE-001',
            'quantity_on_hand' => 3,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['sku']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_inventory_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Old Name',
            'sku' => 'UPD-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->putJson("/api/inventory/{$id}", [
            'name' => 'New Name',
            'quantity_on_hand' => 8,
            'minimum_on_hand' => 2,
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('name', 'New Name')->assertJsonPath('quantity_on_hand', 8);
    }

    // ── Delete / Soft Delete ───────────────────────────────────────────────────

    public function test_tenant_admin_can_soft_delete_inventory_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Delete Me',
            'sku' => 'DEL-001',
            'quantity_on_hand' => 1,
            'minimum_on_hand' => 0,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->deleteJson("/api/inventory/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('message', 'Inventory item moved to recycle bin.');
    }

    // ── Adjust Stock ───────────────────────────────────────────────────────────

    public function test_check_in_increases_stock(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Widget',
            'sku' => 'WGT-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->postJson("/api/inventory/{$id}/adjust-stock", [
            'type' => 'check_in',
            'quantity' => 3,
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('quantity_on_hand', 8);
    }

    public function test_check_out_decreases_stock(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Widget',
            'sku' => 'WGT-002',
            'quantity_on_hand' => 10,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->postJson("/api/inventory/{$id}/adjust-stock", [
            'type' => 'check_out',
            'quantity' => 4,
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('quantity_on_hand', 6);
    }

    public function test_check_out_below_zero_is_rejected(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Limited',
            'sku' => 'LTD-001',
            'quantity_on_hand' => 2,
            'minimum_on_hand' => 0,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->postJson("/api/inventory/{$id}/adjust-stock", [
            'type' => 'check_out',
            'quantity' => 5,
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonPath('message', 'Insufficient stock.');
    }

    public function test_adjust_stock_quantity_must_be_at_least_one(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Item',
            'sku' => 'ITM-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->postJson("/api/inventory/{$id}/adjust-stock", [
            'type' => 'check_in',
            'quantity' => 0,
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['quantity']);
    }

    // ── Search ─────────────────────────────────────────────────────────────────

    public function test_search_by_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Laptop Stand',
            'sku' => 'LS-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Mouse Pad',
            'sku' => 'MP-001',
            'quantity_on_hand' => 10,
            'minimum_on_hand' => 2,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/inventory?search=Laptop', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Laptop Stand', $response->json('data.0.name'));
    }

    public function test_search_by_sku(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Item A',
            'sku' => 'UNIQUE-SKU-99',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Item B',
            'sku' => 'OTHER-001',
            'quantity_on_hand' => 10,
            'minimum_on_hand' => 2,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/inventory?search=UNIQUE-SKU', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('UNIQUE-SKU-99', $response->json('data.0.sku'));
    }

    public function test_search_no_results(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Something',
            'sku' => 'STH-001',
            'quantity_on_hand' => 1,
            'minimum_on_hand' => 0,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/inventory?search=NonExistent', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }
}
