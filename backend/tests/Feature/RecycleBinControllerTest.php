<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RecycleBinControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Create a renewable product and return its id.
     */
    private function makeProduct(mixed $user, mixed $tenant, string $name = 'Test Product'): int
    {
        return (int) $this->actingAs($user)
            ->postJson('/api/renewable-products', ['name' => $name], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json('id');
    }

    /**
     * Create a renewable and return its id.
     */
    private function makeRenewable(mixed $user, mixed $tenant, int $productId, int $clientId): int
    {
        return (int) $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $productId,
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json('id');
    }

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_view_recycle_bin(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/recycle-bin', $this->tenantHeaders($tenant));

        $response->assertOk()
            ->assertJsonStructure(['renewables', 'renewable_products', 'inventory_items']);
    }

    public function test_recycle_bin_index_includes_all_entity_types(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/recycle-bin', $this->tenantHeaders($tenant));

        $response->assertOk()
            ->assertJsonStructure(['renewables', 'renewable_products', 'inventory_items', 'clients', 'sla_items']);
    }

    public function test_standard_user_cannot_view_recycle_bin(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $response = $this->actingAs($user)->getJson('/api/recycle-bin', $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Restore Renewable ──────────────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_renewable(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $productId = $this->makeProduct($user, $tenant);
        $clientId  = $this->createClient($user, $tenant);
        $id = $this->makeRenewable($user, $tenant, $productId, $clientId);

        $this->actingAs($user)->deleteJson("/api/renewables/{$id}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/renewable/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Record restored.');
    }

    // ── Restore Renewable Product ──────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_renewable_product(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $productId = $this->makeProduct($user, $tenant, 'Restorable Product');

        $this->actingAs($user)->deleteJson("/api/renewable-products/{$productId}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/renewable_product/{$productId}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Record restored.');
    }

    // ── Restore Inventory Item ─────────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_inventory_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/inventory', [
            'name'             => 'Restorable Item',
            'sku'              => 'RST-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand'  => 1,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $this->actingAs($user)->deleteJson("/api/inventory/{$id}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/inventory/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Record restored.');
    }

    // ── Invalid entity type ────────────────────────────────────────────────────

    public function test_invalid_entity_type_is_rejected(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson(
            '/api/recycle-bin/malicious_type/1/restore',
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertUnprocessable()->assertJsonPath('message', 'Invalid entity type.');
    }

    // ── Standard user cannot restore ──────────────────────────────────────────

    public function test_standard_user_cannot_restore_records(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $productId = $this->makeProduct($admin, $tenant);
        $clientId  = $this->createClient($admin, $tenant);
        $id = $this->makeRenewable($admin, $tenant, $productId, $clientId);

        $this->actingAs($admin)->deleteJson("/api/renewables/{$id}", [], $this->tenantHeaders($tenant));

        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/renewable/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertForbidden();
    }

    // ── Restore Client ─────────────────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Restorable Client',
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $this->actingAs($user)->deleteJson("/api/clients/{$id}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/client/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Record restored.');
    }

    // ── Restore SLA Item ───────────────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_sla_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/sla-items', [
            'name'       => 'Restorable SLA Item',
            'sku'        => 'SLA-RST-001',
            'sale_price' => 49.99,
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $this->actingAs($user)->deleteJson("/api/sla-items/{$id}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/sla_item/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Record restored.');
    }
}
