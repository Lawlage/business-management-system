<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class ReportControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Create a renewable product via the API and return its payload.
     */
    private function makeProduct(mixed $user, mixed $tenant, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/products', array_merge([
            'name'       => 'Test Product',
            'cost_price' => '50.00',
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create a renewable (client service) via the API and return its payload.
     */
    private function makeRenewable(mixed $user, mixed $tenant, int $productId, int $clientId, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/client-services', array_merge([
            'renewable_product_id' => $productId,
            'client_id'            => $clientId,
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create an inventory item via the API and return its payload.
     */
    private function makeInventoryItem(mixed $user, mixed $tenant, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/inventory', array_merge([
            'name'             => 'Test Item',
            'sku'              => 'TST-' . uniqid(),
            'quantity_on_hand' => 100,
            'minimum_on_hand'  => 5,
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create a stock allocation via the API and return its payload.
     */
    private function makeStockAllocation(mixed $user, mixed $tenant, int $itemId, int $clientId, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/stock-allocations', array_merge([
            'inventory_item_id' => $itemId,
            'client_id'         => $clientId,
            'quantity'           => 5,
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create an SLA item via the API and return its payload.
     */
    private function makeSlaItem(mixed $user, mixed $tenant, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/sla-items', array_merge([
            'name' => 'SLA Item ' . uniqid(),
            'sku'  => 'SLA-' . uniqid(),
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Create an SLA allocation via the API and return its payload.
     */
    private function makeSlaAllocation(mixed $user, mixed $tenant, int $slaItemId, int $clientId, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/sla-allocations', array_merge([
            'sla_item_id' => $slaItemId,
            'client_id'   => $clientId,
            'quantity'     => 1,
        ], $overrides), $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json();
    }

    /**
     * Seed a full set of test data: product, client, renewable, inventory, stock allocation.
     *
     * @return array{product: array, client_id: int, renewable: array, inventory: array, stock_allocation: array}
     */
    private function seedReportData(mixed $user, mixed $tenant): array
    {
        $product = $this->makeProduct($user, $tenant, ['name' => 'Report Product', 'category' => 'Software']);
        $clientId = $this->createClient($user, $tenant, 'Report Client');

        $renewable = $this->makeRenewable($user, $tenant, $product['id'], $clientId, [
            'description'          => 'Annual License',
            'frequency_type'       => 'years',
            'frequency_value'      => 1,
            'frequency_start_date' => Carbon::now()->subMonths(6)->toDateString(),
        ]);

        $inventory = $this->makeInventoryItem($user, $tenant, [
            'name'             => 'Report Item',
            'sku'              => 'RPT-001',
            'quantity_on_hand' => 50,
            'minimum_on_hand'  => 10,
            'location'         => 'Warehouse A',
            'vendor'           => 'Acme Corp',
        ]);

        $allocation = $this->makeStockAllocation($user, $tenant, $inventory['id'], $clientId, [
            'quantity'   => 3,
            'unit_price' => '25.00',
            'notes'      => 'Initial allocation',
        ]);

        return [
            'product'          => $product,
            'client_id'        => $clientId,
            'renewable'        => $renewable,
            'inventory'        => $inventory,
            'stock_allocation' => $allocation,
        ];
    }

    // ── Permission: standard_user cannot access reports ─────────────────────────

    public function test_standard_user_cannot_access_renewal_status_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/renewal-status', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_standard_user_cannot_access_renewals_by_client_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/renewals-by-client', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_standard_user_cannot_access_inventory_summary_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_standard_user_cannot_access_stock_movements_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/stock-movements?from=2026-01-01&to=2026-12-31', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_standard_user_cannot_access_client_portfolio_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/client-portfolio?client_id=1', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    public function test_standard_user_cannot_access_departments_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser);

        $this->actingAs($user)
            ->getJson('/api/reports/departments', $this->tenantHeaders($tenant))
            ->assertForbidden();
    }

    // ── Permission: sub_admin can access reports ────────────────────────────────

    public function test_sub_admin_can_access_renewal_status_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $subAdmin = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($subAdmin)
            ->getJson('/api/reports/renewal-status', $this->tenantHeaders($tenant))
            ->assertOk();
    }

    public function test_sub_admin_can_access_inventory_summary_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $subAdmin = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($subAdmin)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertOk();
    }

    public function test_sub_admin_can_access_departments_report(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $subAdmin = $this->createTenantUser($tenant->id, TenantRole::SubAdmin);

        $this->actingAs($subAdmin)
            ->getJson('/api/reports/departments', $this->tenantHeaders($tenant))
            ->assertOk();
    }

    // ── Renewal Status Summary ──────────────────────────────────────────────────

    public function test_renewal_status_summary_returns_grouped_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/renewal-status', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);

        // Each group should have status, count, and renewables
        $firstGroup = $json[0];
        $this->assertArrayHasKey('status', $firstGroup);
        $this->assertArrayHasKey('count', $firstGroup);
        $this->assertArrayHasKey('renewables', $firstGroup);
        $this->assertGreaterThan(0, $firstGroup['count']);
    }

    public function test_renewal_status_summary_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/renewal-status?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $contentDisposition = $response->headers->get('Content-Disposition');
        $this->assertStringContainsString('attachment', $contentDisposition);
        $this->assertStringContainsString('.csv', $contentDisposition);

        $csv = $response->getContent();
        $this->assertStringContainsString('Status', $csv);
        $this->assertStringContainsString('Description', $csv);
    }

    public function test_renewal_status_summary_empty_when_no_renewables(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/renewal-status', $this->tenantHeaders($tenant))
            ->assertOk();

        $this->assertCount(0, $response->json());
    }

    // ── Renewals By Client ──────────────────────────────────────────────────────

    public function test_renewals_by_client_returns_grouped_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/renewals-by-client', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);

        $firstGroup = $json[0];
        $this->assertArrayHasKey('client_id', $firstGroup);
        $this->assertArrayHasKey('client_name', $firstGroup);
        $this->assertArrayHasKey('count', $firstGroup);
        $this->assertArrayHasKey('renewables', $firstGroup);
    }

    public function test_renewals_by_client_filters_by_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $product = $this->makeProduct($user, $tenant);
        $clientA = $this->createClient($user, $tenant, 'Client A');
        $clientB = $this->createClient($user, $tenant, 'Client B');

        $this->makeRenewable($user, $tenant, $product['id'], $clientA);
        $this->makeRenewable($user, $tenant, $product['id'], $clientB);

        $response = $this->actingAs($user)
            ->getJson("/api/reports/renewals-by-client?client_id={$clientA}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertCount(1, $json);
        $this->assertSame($clientA, $json[0]['client_id']);
    }

    public function test_renewals_by_client_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/renewals-by-client?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Client', $csv);
        $this->assertStringContainsString('Report Client', $csv);
    }

    // ── Renewals Expiring ───────────────────────────────────────────────────────

    public function test_renewals_expiring_returns_data_within_range(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        // The seeded renewable has a next_due_date ~6 months from now.
        $from = Carbon::now()->toDateString();
        $to = Carbon::now()->addYear()->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/renewals-expiring?from={$from}&to={$to}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);
        $this->assertArrayHasKey('description', $json[0]);
        $this->assertArrayHasKey('renewable_product', $json[0]);
        $this->assertArrayHasKey('client', $json[0]);
    }

    public function test_renewals_expiring_excludes_outside_range(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        // Range in the past -- seeded renewable's next_due_date is in the future.
        $from = Carbon::now()->subYears(3)->toDateString();
        $to = Carbon::now()->subYears(2)->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/renewals-expiring?from={$from}&to={$to}", $this->tenantHeaders($tenant))
            ->assertOk();

        $this->assertCount(0, $response->json());
    }

    public function test_renewals_expiring_requires_from_and_to(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/renewals-expiring', $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['from', 'to']);
    }

    public function test_renewals_expiring_validates_to_after_from(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/renewals-expiring?from=2026-06-01&to=2026-01-01', $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
    }

    public function test_renewals_expiring_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $from = Carbon::now()->toDateString();
        $to = Carbon::now()->addYear()->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/renewals-expiring?from={$from}&to={$to}&format=csv", $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Description', $csv);
        $this->assertStringContainsString('Annual License', $csv);
    }

    // ── Inventory Summary ───────────────────────────────────────────────────────

    public function test_inventory_summary_returns_items(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);

        $item = $json[0];
        $this->assertArrayHasKey('name', $item);
        $this->assertArrayHasKey('sku', $item);
        $this->assertArrayHasKey('quantity_on_hand', $item);
        $this->assertArrayHasKey('minimum_on_hand', $item);
        $this->assertArrayHasKey('allocated_quantity', $item);
        $this->assertArrayHasKey('is_low_stock', $item);
        $this->assertArrayHasKey('location', $item);
        $this->assertArrayHasKey('vendor', $item);
    }

    public function test_inventory_summary_includes_allocated_quantity(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        // Find our seeded item by SKU.
        $reportItem = collect($json)->firstWhere('sku', 'RPT-001');
        $this->assertNotNull($reportItem);
        // We allocated 3 units in seedReportData.
        $this->assertSame(3, $reportItem['allocated_quantity']);
    }

    public function test_inventory_summary_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Name', $csv);
        $this->assertStringContainsString('SKU', $csv);
        $this->assertStringContainsString('RPT-001', $csv);
    }

    public function test_inventory_summary_empty_when_no_items(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertOk();

        $this->assertCount(0, $response->json());
    }

    // ── Stock Movements ─────────────────────────────────────────────────────────

    public function test_stock_movements_returns_transactions_in_date_range(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        // The stock allocation created a stock transaction today.
        $from = Carbon::now()->subDay()->toDateString();
        $to = Carbon::now()->addDay()->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/stock-movements?from={$from}&to={$to}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);
        $this->assertArrayHasKey('type', $json[0]);
        $this->assertArrayHasKey('quantity', $json[0]);
        $this->assertArrayHasKey('inventory_item', $json[0]);
    }

    public function test_stock_movements_filters_by_item_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $itemA = $this->makeInventoryItem($user, $tenant, ['name' => 'Item A', 'sku' => 'A-001']);
        $itemB = $this->makeInventoryItem($user, $tenant, ['name' => 'Item B', 'sku' => 'B-001']);

        $this->makeStockAllocation($user, $tenant, $itemA['id'], $clientId, ['quantity' => 2]);
        $this->makeStockAllocation($user, $tenant, $itemB['id'], $clientId, ['quantity' => 3]);

        $from = Carbon::now()->subDay()->toDateString();
        $to = Carbon::now()->addDay()->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/stock-movements?from={$from}&to={$to}&item_id={$itemA['id']}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        foreach ($json as $transaction) {
            $this->assertSame($itemA['id'], $transaction['inventory_item']['id']);
        }
    }

    public function test_stock_movements_requires_from_and_to(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/stock-movements', $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['from', 'to']);
    }

    public function test_stock_movements_validates_to_after_from(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/stock-movements?from=2026-06-01&to=2026-01-01', $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
    }

    public function test_stock_movements_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $from = Carbon::now()->subDay()->toDateString();
        $to = Carbon::now()->addDay()->toDateString();

        $response = $this->actingAs($user)
            ->getJson("/api/reports/stock-movements?from={$from}&to={$to}&format=csv", $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Item', $csv);
        $this->assertStringContainsString('Type', $csv);
    }

    // ── Stock Allocations ───────────────────────────────────────────────────────

    public function test_stock_allocations_report_returns_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/stock-allocations', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);

        $first = $json[0];
        $this->assertArrayHasKey('inventory_item', $first);
        $this->assertArrayHasKey('client', $first);
        $this->assertArrayHasKey('quantity', $first);
        $this->assertArrayHasKey('status', $first);
    }

    public function test_stock_allocations_report_filters_by_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $item = $this->makeInventoryItem($user, $tenant, ['quantity_on_hand' => 200]);
        $clientA = $this->createClient($user, $tenant, 'Client A');
        $clientB = $this->createClient($user, $tenant, 'Client B');

        $this->makeStockAllocation($user, $tenant, $item['id'], $clientA, ['quantity' => 2]);
        $this->makeStockAllocation($user, $tenant, $item['id'], $clientB, ['quantity' => 3]);

        $response = $this->actingAs($user)
            ->getJson("/api/reports/stock-allocations?client_id={$clientA}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertCount(1, $json);
        $this->assertSame($clientA, $json[0]['client']['id']);
    }

    public function test_stock_allocations_report_filters_by_status(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/stock-allocations?status=allocated', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        foreach ($json as $allocation) {
            $this->assertSame('allocated', $allocation['status']);
        }
    }

    public function test_stock_allocations_report_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/stock-allocations?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Item', $csv);
        $this->assertStringContainsString('Client', $csv);
        $this->assertStringContainsString('Status', $csv);
    }

    // ── Client Portfolio ────────────────────────────────────────────────────────

    public function test_client_portfolio_returns_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson("/api/reports/client-portfolio?client_id={$data['client_id']}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertArrayHasKey('client', $json);
        $this->assertArrayHasKey('renewables', $json);
        $this->assertArrayHasKey('allocations', $json);
        $this->assertArrayHasKey('client_service_count', $json);
        $this->assertArrayHasKey('allocation_count', $json);
        $this->assertArrayHasKey('active_allocated_quantity', $json);

        $this->assertSame(1, $json['client_service_count']);
        $this->assertSame(1, $json['allocation_count']);
        $this->assertSame(3, $json['active_allocated_quantity']);
    }

    public function test_client_portfolio_requires_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/client-portfolio', $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['client_id']);
    }

    public function test_client_portfolio_returns_404_for_nonexistent_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)
            ->getJson('/api/reports/client-portfolio?client_id=99999', $this->tenantHeaders($tenant))
            ->assertNotFound();
    }

    public function test_client_portfolio_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $response = $this->actingAs($user)
            ->getJson("/api/reports/client-portfolio?client_id={$data['client_id']}&format=csv", $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Type', $csv);
        $this->assertStringContainsString('Description / Item', $csv);
    }

    // ── SLA Allocations Report ──────────────────────────────────────────────────

    public function test_sla_allocations_report_returns_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);
        $slaItem = $this->makeSlaItem($user, $tenant);
        $this->makeSlaAllocation($user, $tenant, $slaItem['id'], $clientId);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/sla-allocations', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);

        $first = $json[0];
        $this->assertArrayHasKey('sla_item', $first);
        $this->assertArrayHasKey('client', $first);
        $this->assertArrayHasKey('quantity', $first);
        $this->assertArrayHasKey('status', $first);
    }

    public function test_sla_allocations_report_filters_by_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientA = $this->createClient($user, $tenant, 'Client A');
        $clientB = $this->createClient($user, $tenant, 'Client B');
        $slaItem = $this->makeSlaItem($user, $tenant);

        $this->makeSlaAllocation($user, $tenant, $slaItem['id'], $clientA);
        $this->makeSlaAllocation($user, $tenant, $slaItem['id'], $clientB);

        $response = $this->actingAs($user)
            ->getJson("/api/reports/sla-allocations?client_id={$clientA}", $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertCount(1, $json);
        $this->assertSame($clientA, $json[0]['client']['id']);
    }

    public function test_sla_allocations_report_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);
        $slaItem = $this->makeSlaItem($user, $tenant);
        $this->makeSlaAllocation($user, $tenant, $slaItem['id'], $clientId);

        $response = $this->actingAs($user)
            ->getJson('/api/reports/sla-allocations?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('SLA Item', $csv);
        $this->assertStringContainsString('Client', $csv);
        $this->assertStringContainsString('Status', $csv);
    }

    public function test_sla_allocations_report_empty_when_no_allocations(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/sla-allocations', $this->tenantHeaders($tenant))
            ->assertOk();

        $this->assertCount(0, $response->json());
    }

    // ── Departments Report ──────────────────────────────────────────────────────

    public function test_departments_report_returns_data(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        // Create a department via the API.
        $this->actingAs($user)->postJson('/api/departments', [
            'name' => 'Engineering',
        ], $this->tenantHeaders($tenant))->assertCreated();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/departments', $this->tenantHeaders($tenant))
            ->assertOk();

        $json = $response->json();
        $this->assertIsArray($json);
        $this->assertNotEmpty($json);
        $this->assertArrayHasKey('name', $json[0]);
        $this->assertArrayHasKey('renewables_count', $json[0]);
    }

    public function test_departments_report_csv_format(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/departments', [
            'name' => 'Sales',
        ], $this->tenantHeaders($tenant))->assertCreated();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/departments?format=csv', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $this->assertStringContainsString('Department', $csv);
        $this->assertStringContainsString('Sales', $csv);
    }

    public function test_departments_report_empty_when_no_departments(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/departments', $this->tenantHeaders($tenant))
            ->assertOk();

        $this->assertCount(0, $response->json());
    }

    // ── Data integrity: seeded data appears in reports ──────────────────────────

    public function test_seeded_renewable_appears_in_renewal_status_and_by_client_reports(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        // Renewal status summary.
        $statusResponse = $this->actingAs($user)
            ->getJson('/api/reports/renewal-status', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json();

        $allRenewables = collect($statusResponse)->flatMap(fn ($g) => $g['renewables']);
        $found = $allRenewables->contains(fn ($r) => $r['description'] === 'Annual License');
        $this->assertTrue($found, 'Seeded renewable should appear in renewal-status report');

        // Renewals by client.
        $byClientResponse = $this->actingAs($user)
            ->getJson('/api/reports/renewals-by-client', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json();

        $clientGroup = collect($byClientResponse)->firstWhere('client_name', 'Report Client');
        $this->assertNotNull($clientGroup, 'Report Client should appear in renewals-by-client');
        $this->assertSame(1, $clientGroup['count']);
    }

    public function test_seeded_inventory_appears_in_inventory_summary(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $json = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json();

        $item = collect($json)->firstWhere('sku', 'RPT-001');
        $this->assertNotNull($item);
        $this->assertSame('Report Item', $item['name']);
        // 50 initial - 3 allocated = 47
        $this->assertSame(47, $item['quantity_on_hand']);
        $this->assertSame('Warehouse A', $item['location']);
        $this->assertSame('Acme Corp', $item['vendor']);
    }

    public function test_seeded_allocation_appears_in_stock_allocations_report(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $data = $this->seedReportData($user, $tenant);

        $json = $this->actingAs($user)
            ->getJson('/api/reports/stock-allocations', $this->tenantHeaders($tenant))
            ->assertOk()
            ->json();

        $this->assertNotEmpty($json);
        $allocation = $json[0];
        $this->assertSame('Report Item', $allocation['inventory_item']['name']);
        $this->assertSame('Report Client', $allocation['client']['name']);
        $this->assertSame(3, $allocation['quantity']);
        $this->assertEquals('25.00', $allocation['unit_price']);
    }

    // ── CSV filename includes date ──────────────────────────────────────────────

    public function test_csv_filename_includes_current_date(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)
            ->getJson('/api/reports/inventory-summary?format=csv', $this->tenantHeaders($tenant))
            ->assertOk();

        $contentDisposition = $response->headers->get('Content-Disposition');
        $today = Carbon::now()->format('Y-m-d');
        $this->assertStringContainsString($today, $contentDisposition);
    }
}
