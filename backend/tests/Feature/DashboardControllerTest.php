<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class DashboardControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    public function test_dashboard_returns_three_sections(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure([
            'upcoming_renewals',
            'critical_renewals',
            'low_stock_items',
        ]);
    }

    public function test_dashboard_critical_includes_urgent_and_expired_status(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $product = $this->actingAs($user)->postJson('/api/products', [
            'name' => 'License Product',
        ], $this->tenantHeaders($tenant))->json();

        // Due in 3 days → status Urgent → appears in critical.
        $this->actingAs($user)->postJson('/api/client-services', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Critical One',
            'frequency_type'       => 'days',
            'frequency_value'      => 7,
            'frequency_start_date' => now()->subDays(4)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Due in 45 days → status Upcoming → does NOT appear in critical.
        $this->actingAs($user)->postJson('/api/client-services', [
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

    public function test_dashboard_upcoming_includes_action_required_and_upcoming_status(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $product = $this->actingAs($user)->postJson('/api/products', [
            'name' => 'License Product',
        ], $this->tenantHeaders($tenant))->json();

        // Due in 20 days → status Action Required → appears in upcoming.
        $this->actingAs($user)->postJson('/api/client-services', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Action Required',
            'frequency_type'       => 'days',
            'frequency_value'      => 30,
            'frequency_start_date' => now()->subDays(10)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Due in 45 days → status Upcoming → appears in upcoming.
        $this->actingAs($user)->postJson('/api/client-services', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'Upcoming',
            'frequency_type'       => 'days',
            'frequency_value'      => 60,
            'frequency_start_date' => now()->subDays(15)->toDateString(),
        ], $this->tenantHeaders($tenant));

        // Due in 90 days → status No action needed → does NOT appear in upcoming.
        $this->actingAs($user)->postJson('/api/client-services', [
            'renewable_product_id' => $product['id'],
            'client_id'            => $clientId,
            'description'          => 'No Action Needed',
            'frequency_type'       => 'days',
            'frequency_value'      => 90,
            'frequency_start_date' => now()->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/dashboard', $this->tenantHeaders($tenant));

        $upcoming = $response->json('upcoming_renewals');
        $descriptions = array_column($upcoming, 'description');

        $this->assertContains('Action Required', $descriptions);
        $this->assertContains('Upcoming', $descriptions);
        $this->assertNotContains('No Action Needed', $descriptions);
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
