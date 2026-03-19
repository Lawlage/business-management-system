<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class SlaGroupControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_any_tenant_user_can_list_sla_groups(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Group X'], $this->tenantHeaders($tenant))
            ->assertCreated();

        $this->actingAs($user)->getJson('/api/sla-groups', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonStructure([['id', 'name']]);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_sla_group(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Group A'], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->assertJsonPath('name', 'Group A');
    }

    public function test_standard_user_cannot_create_sla_group(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Group B'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_sla_group_name_must_be_unique(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Duplicate'], $this->tenantHeaders($tenant))
            ->assertCreated();

        $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Duplicate'], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_sla_group(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $group = $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Old Name'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/sla-groups/{$group['id']}", ['name' => 'New Name'], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('name', 'New Name');
    }

    public function test_update_allows_same_name_for_self(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $group = $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'Same Name'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/sla-groups/{$group['id']}", ['name' => 'Same Name'], $this->tenantHeaders($tenant))
            ->assertOk();
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_sla_group(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $group = $this->actingAs($user)->postJson('/api/sla-groups', ['name' => 'To Delete'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->deleteJson("/api/sla-groups/{$group['id']}", [], $this->tenantHeaders($tenant))
            ->assertOk();
    }

    // ── Cross-tenant isolation ──────────────────────────────────────────────────

    public function test_sla_groups_are_isolated_between_tenants(): void
    {
        [$user1, $tenant1] = $this->createTenantAdminContext();
        [$user2, $tenant2] = $this->createTenantAdminContext();

        $this->actingAs($user1)->postJson('/api/sla-groups', ['name' => 'Tenant1 Group'], $this->tenantHeaders($tenant1))
            ->assertCreated();

        $response = $this->actingAs($user2)->getJson('/api/sla-groups', $this->tenantHeaders($tenant2));
        $this->assertCount(0, $response->json());
    }
}
