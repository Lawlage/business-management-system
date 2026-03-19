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

        // Create an urgent renewal (within 7 days).
        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Critical One',
            'category' => 'license',
            'expiration_date' => now()->addDays(3)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Create a non-critical renewal (45 days out).
        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Non-Critical',
            'category' => 'license',
            'expiration_date' => now()->addDays(45)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $critical = $response->json('critical_renewals');
        $this->assertCount(1, $critical);
        $this->assertSame('Critical One', $critical[0]['title']);
    }

    public function test_dashboard_threshold_defaults_to_30_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        // Renewal at 20 days should appear in upcoming_renewals.
        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Twenty Days',
            'category' => 'license',
            'expiration_date' => now()->addDays(20)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Renewal at 45 days should NOT appear (default threshold = 30).
        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Forty Five Days',
            'category' => 'license',
            'expiration_date' => now()->addDays(45)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $important = $response->json('upcoming_renewals');
        $titles = array_column($important, 'title');

        $this->assertContains('Twenty Days', $titles);
        $this->assertNotContains('Forty Five Days', $titles);
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
