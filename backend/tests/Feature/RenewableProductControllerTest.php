<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RenewableProductControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    /**
     * Create a renewable product via the API and return its payload.
     *
     * @param mixed $user
     * @param mixed $tenant
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeProduct(mixed $user, mixed $tenant, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/products', array_merge([
            'name'     => 'Office 365 License',
            'category' => 'license',
            'vendor'   => 'Microsoft',
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_renewable_products(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/products', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total']);
    }

    public function test_standard_user_can_list_renewable_products(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/products', $this->tenantHeaders($tenant))
            ->assertOk();
    }

    public function test_index_returns_renewables_count(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->makeProduct($user, $tenant);

        $data = $this->actingAs($user)
            ->getJson('/api/products', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('renewables_count', $data[0]);
    }

    public function test_index_search_filters_by_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->makeProduct($user, $tenant, ['name' => 'ZZZ Unique Product']);
        $this->makeProduct($user, $tenant, ['name' => 'AAA Other Product']);

        $data = $this->actingAs($user)
            ->getJson('/api/products?search=ZZZ', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('ZZZ Unique Product', $data[0]['name']);
    }

    public function test_index_search_filters_by_vendor(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->makeProduct($user, $tenant, ['vendor' => 'SpecialVendorX']);
        $this->makeProduct($user, $tenant, ['name' => 'Product B', 'vendor' => 'OtherVendor']);

        $data = $this->actingAs($user)
            ->getJson('/api/products?search=SpecialVendorX', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('SpecialVendorX', $data[0]['vendor']);
    }

    public function test_index_search_escapes_like_metacharacters(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->makeProduct($user, $tenant, ['name' => 'Safe Product']);

        // A search with SQL LIKE wildcard should not throw or return everything.
        $data = $this->actingAs($user)
            ->getJson('/api/products?search=%25', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        // The literal "%" should not match "Safe Product".
        $this->assertCount(0, $data);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_renewable_product(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->postJson('/api/products', [
                'name'            => 'SSL Certificate',
                'category'        => 'certificate',
                'vendor'          => 'DigiCert',
                'cost_price'      => 99.00,
                'frequency_type'  => 'years',
                'frequency_value' => 1,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->assertJsonPath('name', 'SSL Certificate')
            ->assertJsonPath('category', 'certificate')
            ->assertJsonPath('frequency_type', 'years')
            ->assertJsonPath('frequency_value', 1);
    }

    public function test_create_defaults_cost_price_to_zero(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->postJson('/api/products', ['name' => 'Free Product'], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertEquals('0.00', $response['cost_price']);
    }

    public function test_create_allows_null_frequency_for_non_expiring_product(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->postJson('/api/products', [
                'name'           => 'Non-Expiring License',
                'frequency_type' => null,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->assertJsonPath('frequency_type', null);
    }

    public function test_create_requires_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->postJson('/api/products', [], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_sub_admin_can_create_renewable_product(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($user)
            ->postJson('/api/products', ['name' => 'Sub Admin Product'], $this->tenantHeaders($tenant))
            ->assertCreated();
    }

    public function test_standard_user_cannot_create_renewable_product(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->postJson('/api/products', ['name' => 'Should Fail'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_renewable_product(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);

        $this->actingAs($user)
            ->putJson("/api/products/{$product['id']}", [
                'name'   => 'Updated Name',
                'vendor' => 'New Vendor',
            ], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('name', 'Updated Name')
            ->assertJsonPath('vendor', 'New Vendor');
    }

    public function test_standard_user_cannot_update_renewable_product(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->putJson("/api/products/{$product['id']}", ['name' => 'Hacked'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_sub_admin_with_can_edit_false_cannot_update(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin, canEdit: false);

        $this->actingAs($user)
            ->putJson("/api/products/{$product['id']}", ['name' => 'Hacked'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_renewable_product(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);

        $this->actingAs($user)
            ->deleteJson("/api/products/{$product['id']}", [], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('message', 'Renewable product moved to recycle bin.');
    }

    public function test_standard_user_cannot_delete_renewable_product(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->deleteJson("/api/products/{$product['id']}", [], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_sub_admin_cannot_delete_renewable_product(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($user)
            ->deleteJson("/api/products/{$product['id']}", [], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Cross-tenant isolation ─────────────────────────────────────────────────

    public function test_cannot_read_other_tenants_renewable_products(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        // Create a product in tenant A.
        $this->makeProduct($userA, $tenantA, ['name' => 'Tenant A Product']);

        // Tenant B should see empty list.
        $data = $this->actingAs($userB)
            ->getJson('/api/products', $this->tenantHeaders($tenantB))
            ->assertOk()
            ->json('data');

        $this->assertCount(0, $data);
    }

    public function test_cannot_update_other_tenants_renewable_product(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        $product = $this->makeProduct($userA, $tenantA);

        // UserB tries to update TenantA's product using TenantB's context.
        $this->actingAs($userB)
            ->putJson("/api/products/{$product['id']}", ['name' => 'Hacked'], $this->tenantHeaders($tenantB))
            ->assertNotFound();
    }

    public function test_cannot_delete_other_tenants_renewable_product(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        $product = $this->makeProduct($userA, $tenantA);

        $this->actingAs($userB)
            ->deleteJson("/api/products/{$product['id']}", [], $this->tenantHeaders($tenantB))
            ->assertNotFound();
    }
}
