<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class DashboardControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    public function test_dashboard_returns_four_sections(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure([
            'upcoming_renewals',
            'critical_renewals',
            'low_stock_items',
            'upcoming_sla_allocations',
        ]);
    }

    public function test_dashboard_critical_renewals_only_within_seven_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $product = $this->actingAs($user)->postJson('/api/renewable-products', [
            'name' => 'License Product',
        ], $this->tenantHeaders($tenant))->json();

        // Renewable due in 3 days (start 4 days ago, every 7 days → 3 days from now).
        $this->actingAs($user)->postJson('/api/renewables', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Critical One',
            'frequency_type'       => 'days',
            'frequency_value'      => 7,
            'frequency_start_date' => now()->subDays(4)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Renewable due in 45 days (start 15 days ago, every 60 days → 45 days from now).
        $this->actingAs($user)->postJson('/api/renewables', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Non-Critical',
            'frequency_type'       => 'days',
            'frequency_value'      => 60,
            'frequency_start_date' => now()->subDays(15)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $critical = $response->json('critical_renewals');
        $this->assertCount(1, $critical);
        $this->assertSame('Critical One', $critical[0]['description']);
    }

    public function test_dashboard_threshold_defaults_to_30_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $product = $this->actingAs($user)->postJson('/api/renewable-products', [
            'name' => 'License Product',
        ], $this->tenantHeaders($tenant))->json();

        // Renewable at ~20 days: start 10 days ago, every 30 days → 20 days from now.
        $this->actingAs($user)->postJson('/api/renewables', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Twenty Days',
            'frequency_type'       => 'days',
            'frequency_value'      => 30,
            'frequency_start_date' => now()->subDays(10)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Renewable at ~45 days: start 15 days ago, every 60 days → 45 days from now.
        $this->actingAs($user)->postJson('/api/renewables', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Forty Five Days',
            'frequency_type'       => 'days',
            'frequency_value'      => 60,
            'frequency_start_date' => now()->subDays(15)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $important = $response->json('upcoming_renewals');
        $descriptions = array_column($important, 'description');

        $this->assertContains('Twenty Days', $descriptions);
        $this->assertNotContains('Forty Five Days', $descriptions);
    }

    public function test_dashboard_threshold_is_capped_at_365_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        // Passing threshold=999 should be rejected with validation error.
        $response = $this->actingAs($user)->getJson(
            '/api/dashboard?renewal_threshold_days=999',
            $this->tenantHeaders($tenant)
        );

        $response->assertUnprocessable()->assertJsonValidationErrors(['renewal_threshold_days']);
    }

    public function test_dashboard_rejects_negative_threshold(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson(
            '/api/dashboard?renewal_threshold_days=0',
            $this->tenantHeaders($tenant)
        );

        $response->assertUnprocessable()->assertJsonValidationErrors(['renewal_threshold_days']);
    }

    public function test_sla_allocation_with_renewal_date_appears_in_upcoming(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $slaItem = $this->actingAs($user)->postJson('/api/sla-items', [
            'name' => 'Test SLA',
            'sku' => 'SLA-DASH-001',
            'sale_price' => 99.00,
        ], $this->tenantHeaders($tenant))->json();

        $client = $this->actingAs($user)->postJson('/api/clients', [
            'name' => 'Dash Client',
        ], $this->tenantHeaders($tenant))->json();

        // Allocation with renewal_date within 30 days.
        $this->actingAs($user)->postJson('/api/sla-allocations', [
            'sla_item_id' => $slaItem['id'],
            'client_id' => $client['id'],
            'quantity' => 1,
            'renewal_date' => now()->addDays(10)->toDateString(),
        ], $this->tenantHeaders($tenant))->assertCreated();

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $allocations = $response->json('upcoming_sla_allocations');
        $this->assertCount(1, $allocations);
        $this->assertSame('Test SLA', $allocations[0]['sla_item']['name']);
    }

    public function test_low_stock_items_appear_when_below_minimum(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        // Item below minimum.
        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Low Widget',
            'sku' => 'LOW-001',
            'quantity_on_hand' => 1,
            'minimum_on_hand' => 5,
        ], $this->tenantHeaders($tenant));

        // Item at or above minimum.
        $this->actingAs($user)->postJson('/api/inventory', [
            'name' => 'Stocked Widget',
            'sku' => 'STK-001',
            'quantity_on_hand' => 10,
            'minimum_on_hand' => 5,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $lowStock = $response->json('low_stock_items');
        $names = array_column($lowStock, 'name');

        $this->assertContains('Low Widget', $names);
        $this->assertNotContains('Stocked Widget', $names);
    }
}
