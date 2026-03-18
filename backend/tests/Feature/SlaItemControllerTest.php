<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class SlaItemControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_sla_items(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/sla-items', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page']);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_create_sla_item(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, \App\Enums\TenantRole::SubAdmin);

        $response = $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'Premium Support',
            'sku' => 'SLA-PREM-001',
            'tier' => 'Premium',
            'response_time' => '1 hour',
            'resolution_time' => '4 hours',
            'cost_price' => 50.00,
            'sale_price' => 149.00,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('name', 'Premium Support')
            ->assertJsonPath('sku', 'SLA-PREM-001')
            ->assertJsonPath('sale_price', '149.00');
    }

    public function test_standard_user_cannot_create_sla_item(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'Basic SLA',
            'sku' => 'SLA-BASIC-001',
        ], $this->tenantHeaders($tenant))->assertForbidden();
    }

    public function test_sla_item_sku_must_be_unique(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'SLA A',
            'sku' => 'SLA-DUP-001',
        ], $this->tenantHeaders($tenant))->assertCreated();

        $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'SLA B',
            'sku' => 'SLA-DUP-001',
        ], $this->tenantHeaders($tenant))->assertUnprocessable();
    }

    public function test_sla_item_requires_name_and_sku(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-items', [], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'sku']);
    }

    public function test_sla_item_defaults_pricing_to_zero(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'Free SLA',
            'sku' => 'SLA-FREE-001',
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('cost_price', '0.00')
            ->assertJsonPath('sale_price', '0.00');
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_update_sla_item(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, \App\Enums\TenantRole::SubAdmin);

        $item = $this->actingAs($admin)->postJson('/api/sla-items', [
            'name' => 'Old Name',
            'sku' => 'SLA-UPD-001',
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/sla-items/{$item['id']}", [
            'name' => 'New Name',
            'sale_price' => 200.00,
        ], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('name', 'New Name')
            ->assertJsonPath('sale_price', '200.00');
    }

    public function test_standard_user_cannot_update_sla_item(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $item = $this->actingAs($admin)->postJson('/api/sla-items', [
            'name' => 'Locked SLA',
            'sku' => 'SLA-LOCK-001',
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/sla-items/{$item['id']}", [
            'name' => 'Hacked',
        ], $this->tenantHeaders($tenant))->assertForbidden();
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_sla_item(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $item = $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'To Delete',
            'sku' => 'SLA-DEL-001',
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->deleteJson("/api/sla-items/{$item['id']}", [], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('message', 'SLA item moved to recycle bin.');
    }

    // ── Search ─────────────────────────────────────────────────────────────────

    public function test_search_filters_sla_items_by_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-items', ['name' => 'Gold Plan', 'sku' => 'SLA-GOLD-001'], $this->tenantHeaders($tenant));
        $this->actingAs($user)->postJson('/api/sla-items', ['name' => 'Silver Plan', 'sku' => 'SLA-SLV-001'], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/sla-items?search=Gold', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Gold Plan', $response->json('data.0.name'));
    }

    // ── Cross-tenant isolation ──────────────────────────────────────────────────

    public function test_sla_items_are_isolated_between_tenants(): void
    {
        [$user1, $tenant1] = $this->createTenantAdminContext();
        [$user2, $tenant2] = $this->createTenantAdminContext();

        $this->actingAs($user1)->postJson('/api/sla-items', [
            'name' => 'Tenant1 SLA',
            'sku' => 'SLA-T1-001',
        ], $this->tenantHeaders($tenant1))->assertCreated();

        $response = $this->actingAs($user2)->getJson('/api/sla-items', $this->tenantHeaders($tenant2));
        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }
}
