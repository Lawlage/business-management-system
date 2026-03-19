<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RenewableControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    /**
     * Create a renewable product via the API and return its id.
     *
     * @param mixed $user
     * @param mixed $tenant
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeProduct(mixed $user, mixed $tenant, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/renewable-products', array_merge([
            'name'       => 'Test Product',
            'cost_price' => '50.00',
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create a renewable via the API and return its payload.
     *
     * @param mixed $user
     * @param mixed $tenant
     * @param int   $productId
     * @param int   $clientId
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeRenewable(mixed $user, mixed $tenant, int $productId, int $clientId, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/renewables', array_merge([
            'renewable_product_id' => $productId,
            'client_id'            => $clientId,
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    // ── Index / List ───────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_renewables(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/renewables', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total']);
    }

    public function test_standard_user_can_list_renewables(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/renewables', $this->tenantHeaders($tenant))
            ->assertOk();
    }

    public function test_index_loads_relations(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);
        $this->makeRenewable($user, $tenant, $product['id'], $clientId);

        $item = $this->actingAs($user)
            ->getJson('/api/renewables', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data.0');

        $this->assertArrayHasKey('renewable_product', $item);
        $this->assertArrayHasKey('client', $item);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_renewable(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, ['name' => 'Annual License', 'cost_price' => '120.00']);
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->assertJsonPath('renewable_product.id', $product['id'])
            ->assertJsonPath('client.id', $clientId);
    }

    public function test_create_auto_fills_description_from_product_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, ['name' => 'My Product Name']);
        $clientId = $this->createClient($user, $tenant);

        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertSame('My Product Name', $data['description']);
    }

    public function test_create_allows_custom_description(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, ['name' => 'Base Product']);
        $clientId = $this->createClient($user, $tenant);

        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
                'description'          => 'Custom Description',
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertSame('Custom Description', $data['description']);
    }

    public function test_create_auto_fills_sale_price_from_product_cost_price(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, ['cost_price' => '99.50']);
        $clientId = $this->createClient($user, $tenant);

        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertEquals('99.50', $data['sale_price']);
    }

    public function test_create_allows_custom_sale_price(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, ['cost_price' => '50.00']);
        $clientId = $this->createClient($user, $tenant);

        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
                'sale_price'           => '199.00',
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertEquals('199.00', $data['sale_price']);
    }

    public function test_create_computes_next_due_date_from_frequency(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);

        // Start 1 year + 1 day ago, every 1 year → next due is ~364 days from now.
        $startDate = Carbon::now()->subYear()->subDay()->toDateString();
        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
                'frequency_type'       => 'years',
                'frequency_value'      => 1,
                'frequency_start_date' => $startDate,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertNotNull($data['next_due_date']);
        $this->assertNotNull($data['status']);
        // Next due should be in the future.
        $nextDue = Carbon::parse($data['next_due_date']);
        $this->assertTrue($nextDue->isAfter(Carbon::now()));
    }

    public function test_create_next_due_null_for_non_expiring_product_without_frequency(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        // Product with no frequency.
        $product = $this->makeProduct($user, $tenant, ['frequency_type' => null]);
        $clientId = $this->createClient($user, $tenant);

        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        $this->assertNull($data['next_due_date']);
        $this->assertNull($data['status']);
    }

    public function test_create_inherits_product_frequency_when_not_overridden(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant, [
            'frequency_type'  => 'months',
            'frequency_value' => 12,
        ]);
        $clientId = $this->createClient($user, $tenant);

        $startDate = Carbon::now()->subMonths(13)->toDateString();
        $data = $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
                // No frequency_type/value override, but supply a start_date.
                'frequency_start_date' => $startDate,
            ], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();

        // Product's 12-month frequency + start_date → next_due_date should be ~11 months from now.
        $this->assertNotNull($data['next_due_date']);
        $nextDue = Carbon::parse($data['next_due_date']);
        $this->assertTrue($nextDue->isAfter(Carbon::now()));
    }

    public function test_create_requires_renewable_product_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)
            ->postJson('/api/renewables', ['client_id' => $clientId], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['renewable_product_id']);
    }

    public function test_create_requires_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);

        $this->actingAs($user)
            ->postJson('/api/renewables', ['renewable_product_id' => $product['id']], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['client_id']);
    }

    public function test_sub_admin_can_create_renewable(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $clientId = $this->createClient($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertCreated();
    }

    public function test_standard_user_cannot_create_renewable(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $clientId = $this->createClient($admin, $tenant);
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->postJson('/api/renewables', [
                'renewable_product_id' => $product['id'],
                'client_id'            => $clientId,
            ], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Filters ────────────────────────────────────────────────────────────────

    public function test_index_filters_by_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientA = $this->createClient($user, $tenant, 'Client A');
        $clientB = $this->createClient($user, $tenant, 'Client B');

        $this->makeRenewable($user, $tenant, $product['id'], $clientA);
        $this->makeRenewable($user, $tenant, $product['id'], $clientB);

        $data = $this->actingAs($user)
            ->getJson("/api/renewables?client_id={$clientA}", $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame($clientA, $data[0]['client_id']);
    }

    public function test_index_filters_by_renewable_product_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $productA = $this->makeProduct($user, $tenant, ['name' => 'Product A']);
        $productB = $this->makeProduct($user, $tenant, ['name' => 'Product B']);
        $clientId = $this->createClient($user, $tenant);

        $this->makeRenewable($user, $tenant, $productA['id'], $clientId);
        $this->makeRenewable($user, $tenant, $productB['id'], $clientId);

        $data = $this->actingAs($user)
            ->getJson("/api/renewables?renewable_product_id={$productA['id']}", $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame($productA['id'], $data[0]['renewable_product_id']);
    }

    public function test_index_filters_by_status(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);

        // Create one with an expiring-soon date (Urgent status).
        $this->makeRenewable($user, $tenant, $product['id'], $clientId, [
            'frequency_type'       => 'days',
            'frequency_value'      => 365,
            'frequency_start_date' => Carbon::now()->subDays(362)->toDateString(),
        ]);
        // Create one with far future next due (No action needed).
        $this->makeRenewable($user, $tenant, $product['id'], $clientId, [
            'frequency_type'       => 'years',
            'frequency_value'      => 1,
            'frequency_start_date' => Carbon::now()->addDays(5)->toDateString(),
        ]);

        $urgentData = $this->actingAs($user)
            ->getJson('/api/renewables?status=Urgent', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        foreach ($urgentData as $item) {
            $this->assertSame('Urgent', $item['status']);
        }
    }

    public function test_index_filters_by_expiry_preset_next_30_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);

        // Start 20 days ago, every 30 days → next due ≈ 10 days from now — should appear.
        $this->makeRenewable($user, $tenant, $product['id'], $clientId, [
            'frequency_type'       => 'days',
            'frequency_value'      => 30,
            'frequency_start_date' => Carbon::now()->subDays(20)->toDateString(),
        ]);
        // Start 60 days from now → next due is 60 days from now — should NOT appear.
        $this->makeRenewable($user, $tenant, $product['id'], $clientId, [
            'frequency_type'       => 'years',
            'frequency_value'      => 1,
            'frequency_start_date' => Carbon::now()->addDays(60)->toDateString(),
        ]);

        $data = $this->actingAs($user)
            ->getJson('/api/renewables?expiry_preset=next_30_days', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
    }

    public function test_index_search_by_description(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);

        $this->makeRenewable($user, $tenant, $product['id'], $clientId, ['description' => 'ZZZ Unique Description']);
        $this->makeRenewable($user, $tenant, $product['id'], $clientId, ['description' => 'Other Description']);

        $data = $this->actingAs($user)
            ->getJson('/api/renewables?search=ZZZ+Unique', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('ZZZ Unique Description', $data[0]['description']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_renewable(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);
        $renewable = $this->makeRenewable($user, $tenant, $product['id'], $clientId);

        $this->actingAs($user)
            ->putJson("/api/renewables/{$renewable['id']}", [
                'description' => 'Updated Description',
                'notes'       => 'Some notes',
            ], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('description', 'Updated Description')
            ->assertJsonPath('notes', 'Some notes');
    }

    public function test_update_recomputes_next_due_date_on_frequency_change(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);
        $renewable = $this->makeRenewable($user, $tenant, $product['id'], $clientId);

        $this->assertNull($renewable['next_due_date']);

        $startDate = Carbon::now()->subMonths(6)->toDateString();

        $updated = $this->actingAs($user)
            ->putJson("/api/renewables/{$renewable['id']}", [
                'frequency_type'       => 'months',
                'frequency_value'      => 12,
                'frequency_start_date' => $startDate,
            ], $this->tenantHeaders($tenant))
            ->assertOk()
            ->json();

        $this->assertNotNull($updated['next_due_date']);
    }

    public function test_standard_user_cannot_update_renewable(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $clientId = $this->createClient($admin, $tenant);
        $renewable = $this->makeRenewable($admin, $tenant, $product['id'], $clientId);
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->putJson("/api/renewables/{$renewable['id']}", ['description' => 'Hacked'], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_renewable(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientId = $this->createClient($user, $tenant);
        $renewable = $this->makeRenewable($user, $tenant, $product['id'], $clientId);

        $this->actingAs($user)
            ->deleteJson("/api/renewables/{$renewable['id']}", [], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('message', 'Renewable moved to recycle bin.');
    }

    public function test_standard_user_cannot_delete_renewable(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($admin, $tenant);
        $clientId = $this->createClient($admin, $tenant);
        $renewable = $this->makeRenewable($admin, $tenant, $product['id'], $clientId);
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->deleteJson("/api/renewables/{$renewable['id']}", [], $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Cross-tenant isolation ─────────────────────────────────────────────────

    public function test_cannot_read_other_tenants_renewables(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        $product = $this->makeProduct($userA, $tenantA);
        $clientId = $this->createClient($userA, $tenantA);
        $this->makeRenewable($userA, $tenantA, $product['id'], $clientId);

        $data = $this->actingAs($userB)
            ->getJson('/api/renewables', $this->tenantHeaders($tenantB))
            ->assertOk()
            ->json('data');

        $this->assertCount(0, $data);
    }

    public function test_cannot_update_other_tenants_renewable(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        $product = $this->makeProduct($userA, $tenantA);
        $clientId = $this->createClient($userA, $tenantA);
        $renewable = $this->makeRenewable($userA, $tenantA, $product['id'], $clientId);

        $this->actingAs($userB)
            ->putJson("/api/renewables/{$renewable['id']}", ['description' => 'Hacked'], $this->tenantHeaders($tenantB))
            ->assertNotFound();
    }

    public function test_cannot_delete_other_tenants_renewable(): void
    {
        [$userA, $tenantA] = $this->createTenantAdminContext();
        [$userB, $tenantB] = $this->createTenantAdminContext();

        $product = $this->makeProduct($userA, $tenantA);
        $clientId = $this->createClient($userA, $tenantA);
        $renewable = $this->makeRenewable($userA, $tenantA, $product['id'], $clientId);

        $this->actingAs($userB)
            ->deleteJson("/api/renewables/{$renewable['id']}", [], $this->tenantHeaders($tenantB))
            ->assertNotFound();
    }
}
