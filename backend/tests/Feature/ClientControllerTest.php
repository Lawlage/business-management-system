<?php

namespace Tests\Feature;

use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class ClientControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index / List ───────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_clients(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/clients', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total']);
    }

    public function test_standard_user_can_list_clients(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->getJson('/api/clients', $this->tenantHeaders($tenant));

        $response->assertOk();
    }

    public function test_all_param_returns_unpaginated_list(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Client A',
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Client B',
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/clients?all=1', $this->tenantHeaders($tenant));

        $response->assertOk();
        $data = $response->json();
        $this->assertCount(2, $data);
        $this->assertArrayHasKey('id', $data[0]);
        $this->assertArrayHasKey('name', $data[0]);
        $this->assertArrayNotHasKey('email', $data[0]);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Acme Industries',
            'contact_name' => 'John Smith',
            'email' => 'john@acme.example.com',
            'phone' => '+64 21 555 0100',
            'website' => 'https://acme.example.com',
            'notes' => 'Primary partner.',
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('name', 'Acme Industries')
            ->assertJsonPath('contact_name', 'John Smith')
            ->assertJsonPath('email', 'john@acme.example.com');
    }

    public function test_standard_user_cannot_create_client(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Blocked Client',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_create_client_requires_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/clients', [], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['name']);
    }

    public function test_create_client_validates_email_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Test Client',
            'email' => 'not-an-email',
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }

    public function test_create_client_validates_website_url(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Test Client',
            'website' => 'not-a-url',
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['website']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Old Name',
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->putJson("/api/clients/{$id}", [
            'name' => 'New Name',
            'email' => 'new@example.com',
        ], $this->tenantHeaders($tenant));

        $response->assertOk()
            ->assertJsonPath('name', 'New Name')
            ->assertJsonPath('email', 'new@example.com');
    }

    public function test_standard_user_cannot_update_client(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($admin)->postJson('/api/clients', [
            'name' => 'Protected',
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->putJson("/api/clients/{$id}", [
            'name' => 'Should Fail',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Delete / Soft Delete ───────────────────────────────────────────────────

    public function test_tenant_admin_can_soft_delete_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Delete Me',
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->deleteJson("/api/clients/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('message', 'Client moved to recycle bin.');
    }

    public function test_standard_user_cannot_delete_client(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($admin)->postJson('/api/clients', [
            'name' => 'Protected',
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->deleteJson("/api/clients/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Search ─────────────────────────────────────────────────────────────────

    public function test_search_by_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/clients', ['name' => 'Acme Industries'], $this->tenantHeaders($tenant));
        $this->actingAs($user)->postJson('/api/clients', ['name' => 'Globex Corp'], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/clients?search=Acme', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Acme Industries', $response->json('data.0.name'));
    }

    public function test_search_by_email(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Client A',
            'email' => 'unique-test@acme.example.com',
        ], $this->tenantHeaders($tenant));
        $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Client B',
            'email' => 'other@globex.example.com',
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/clients?search=unique-test', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    // ── Cross-tenant isolation ────────────────────────────────────────────────

    public function test_user_cannot_access_other_tenants_clients(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        $create = $this->actingAs($adminA)->postJson('/api/clients', [
            'name' => 'Tenant A Client',
        ], $this->tenantHeaders($tenantA));

        $id = $create->json('id');

        $response = $this->actingAs($adminB)->putJson("/api/clients/{$id}", [
            'name' => 'Should Not Update',
        ], $this->tenantHeaders($tenantB));

        $response->assertNotFound();
    }
}
