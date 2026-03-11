<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RecycleBinControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_view_recycle_bin(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/recycle-bin', $this->tenantHeaders($tenant));

        $response->assertOk()
            ->assertJsonStructure(['renewals', 'inventory_items']);
    }

    public function test_standard_user_cannot_view_recycle_bin(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->getJson('/api/recycle-bin', $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Restore Renewal ────────────────────────────────────────────────────────

    public function test_tenant_admin_can_restore_soft_deleted_renewal(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Restorable Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $this->actingAs($user)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/renewal/{$id}/restore",
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
            'name' => 'Restorable Item',
            'sku' => 'RST-001',
            'quantity_on_hand' => 5,
            'minimum_on_hand' => 1,
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

        $create = $this->actingAs($admin)->postJson('/api/renewals', [
            'title' => 'Protected Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $this->actingAs($admin)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson(
            "/api/recycle-bin/renewal/{$id}/restore",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertForbidden();
    }
}
