<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class SlaAllocationControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    private function createSlaItem(mixed $user, mixed $tenant, string $sku = 'SLA-TEST-001'): array
    {
        return $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'Test SLA',
            'sku' => $sku,
            'sale_price' => 100.00,
        ], $this->tenantHeaders($tenant))->json();
    }

    private function createClient(mixed $user, mixed $tenant, string $name = 'Test Client'): array
    {
        return $this->actingAs($user)->postJson('/api/clients', [
            'name' => $name,
        ], $this->tenantHeaders($tenant))->json();
    }

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_sla_allocations(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->getJson('/api/sla-allocations', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonStructure(['data', 'current_page']);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_apply_sla_to_client(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $slaItem = $this->createSlaItem($admin, $tenant);
        $client = $this->createClient($admin, $tenant);

        $response = $this->actingAs($user)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 2,
            'unit_price' => 95.00,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('quantity', 2);
    }

    public function test_standard_user_cannot_apply_sla(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $slaItem = $this->createSlaItem($admin, $tenant);
        $client = $this->createClient($admin, $tenant);

        $this->actingAs($user)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 1,
        ], $this->tenantHeaders($tenant))->assertForbidden();
    }

    public function test_sla_allocation_requires_sla_item_and_client(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($admin)->postJson('/api/sla-allocations', [], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sla_item_id', 'client_id', 'quantity']);
    }

    // ── Cancel ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_cancel_sla_allocation(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $slaItem = $this->createSlaItem($admin, $tenant);
        $client = $this->createClient($admin, $tenant);

        $allocation = $this->actingAs($admin)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 1,
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->postJson("/api/sla-allocations/{$allocation['id']}/cancel", [], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_cannot_cancel_already_cancelled_allocation(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $slaItem = $this->createSlaItem($admin, $tenant);
        $client = $this->createClient($admin, $tenant);

        $allocation = $this->actingAs($admin)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 1,
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($admin)->postJson("/api/sla-allocations/{$allocation['id']}/cancel", [], $this->tenantHeaders($tenant))
            ->assertOk();

        $this->actingAs($admin)->postJson("/api/sla-allocations/{$allocation['id']}/cancel", [], $this->tenantHeaders($tenant))
            ->assertUnprocessable();
    }

    // ── Cross-tenant isolation ──────────────────────────────────────────────────

    public function test_sla_allocations_are_isolated_between_tenants(): void
    {
        [$user1, $tenant1] = $this->createTenantAdminContext();
        [$user2, $tenant2] = $this->createTenantAdminContext();

        $slaItem = $this->createSlaItem($user1, $tenant1);
        $client = $this->createClient($user1, $tenant1);

        $this->actingAs($user1)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 1,
        ], $this->tenantHeaders($tenant1))->assertCreated();

        $response = $this->actingAs($user2)->getJson('/api/sla-allocations', $this->tenantHeaders($tenant2));
        $this->assertCount(0, $response->json('data'));
    }
}
