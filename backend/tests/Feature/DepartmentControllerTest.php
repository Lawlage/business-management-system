<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class DepartmentControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_any_tenant_user_can_list_departments(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/departments', ['name' => 'Engineering'], $this->tenantHeaders($tenant))
            ->assertCreated();

        $response = $this->actingAs($user)->getJson('/api/departments', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure([['id', 'name']]);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_department(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/departments', [
            'name' => 'Engineering',
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('name', 'Engineering');
    }

    public function test_standard_user_cannot_create_department(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/departments', [
            'name' => 'Sales',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_department_name_must_be_unique(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/departments', ['name' => 'Finance'], $this->tenantHeaders($tenant))
            ->assertCreated();

        $this->actingAs($user)->postJson('/api/departments', ['name' => 'Finance'], $this->tenantHeaders($tenant))
            ->assertUnprocessable();
    }

    public function test_department_name_is_required(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/departments', [], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_department(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $created = $this->actingAs($user)->postJson('/api/departments', [
            'name' => 'Operations',
        ], $this->tenantHeaders($tenant))->json();

        $response = $this->actingAs($user)->deleteJson("/api/departments/{$created['id']}", [], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('message', 'Department deleted.');
    }

    public function test_standard_user_cannot_delete_department(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $created = $this->actingAs($admin)->postJson('/api/departments', [
            'name' => 'HR',
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->deleteJson("/api/departments/{$created['id']}", [], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_department_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $dept = $this->actingAs($user)->postJson('/api/departments', ['name' => 'Old Name'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/departments/{$dept['id']}", ['name' => 'New Name'], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('name', 'New Name');
    }

    public function test_update_with_duplicate_name_returns_422(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/departments', ['name' => 'HR'], $this->tenantHeaders($tenant))->assertCreated();
        $dept2 = $this->actingAs($user)->postJson('/api/departments', ['name' => 'IT'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/departments/{$dept2['id']}", ['name' => 'HR'], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_update_allows_same_name_for_self(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $dept = $this->actingAs($user)->postJson('/api/departments', ['name' => 'Support'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/departments/{$dept['id']}", ['name' => 'Support'], $this->tenantHeaders($tenant))
            ->assertOk();
    }

    public function test_update_with_valid_manager_id_succeeds(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $dept = $this->actingAs($user)->postJson('/api/departments', ['name' => 'Ops'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/departments/{$dept['id']}", [
            'name' => 'Ops',
            'manager_id' => $user->id,
        ], $this->tenantHeaders($tenant))->assertOk();
    }

    public function test_standard_user_cannot_update_department(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $dept = $this->actingAs($admin)->postJson('/api/departments', ['name' => 'Finance'], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->putJson("/api/departments/{$dept['id']}", ['name' => 'Budget'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Cross-tenant isolation ──────────────────────────────────────────────────

    public function test_departments_are_isolated_between_tenants(): void
    {
        [$user1, $tenant1] = $this->createTenantAdminContext();
        [$user2, $tenant2] = $this->createTenantAdminContext();

        $this->actingAs($user1)->postJson('/api/departments', ['name' => 'Tenant1-Dept'], $this->tenantHeaders($tenant1))
            ->assertCreated();

        // Tenant2 should see 0 departments (their own empty list)
        $response = $this->actingAs($user2)->getJson('/api/departments', $this->tenantHeaders($tenant2));
        $response->assertOk();
        $this->assertEmpty($response->json());
    }
}
