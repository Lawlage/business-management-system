<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RenewalControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    /**
     * Create a renewal via the API (always includes a client_id).
     *
     * @param mixed  $user
     * @param mixed  $tenant
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeRenewal(mixed $user, mixed $tenant, array $overrides = []): array
    {
        $clientId = $this->createClient($user, $tenant);

        return $this->actingAs($user)->postJson('/api/renewals', array_merge([
            'title' => 'Test Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $overrides), $this->tenantHeaders($tenant))->json();
    }

    // ── Index / List ───────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_renewals(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/renewals', $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total']);
    }

    public function test_standard_user_can_list_renewals(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->getJson('/api/renewals', $this->tenantHeaders($tenant));

        $response->assertOk();
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_renewal(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Adobe Acrobat License',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('title', 'Adobe Acrobat License')
            ->assertJsonPath('status', 'No action needed');
    }

    public function test_status_is_auto_calculated_on_create(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Urgent Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(3)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()->assertJsonPath('status', 'Urgent');
    }

    public function test_standard_user_cannot_create_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);
        $clientId = $this->createClient($admin, $tenant);

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Test',
            'category' => 'license',
            'expiration_date' => now()->addDays(30)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_create_renewal_requires_title_and_category_and_expiration_date(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/renewals', [], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['title', 'category', 'expiration_date', 'client_id']);
    }

    public function test_create_renewal_without_client_id_returns_422(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'No Client',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant))->assertUnprocessable()->assertJsonValidationErrors(['client_id']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_renewal(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($user, $tenant, ['title' => 'Old Title', 'category' => 'contract'])['id'];

        $response = $this->actingAs($user)->putJson("/api/renewals/{$id}", [
            'title' => 'New Title',
            'expiration_date' => now()->addDays(5)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertOk()
            ->assertJsonPath('title', 'New Title')
            ->assertJsonPath('status', 'Urgent');
    }

    public function test_status_is_recalculated_on_expiration_date_update(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($user, $tenant)['id'];

        $response = $this->actingAs($user)->putJson("/api/renewals/{$id}", [
            'expiration_date' => now()->addDays(3)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('status', 'Urgent');
    }

    public function test_standard_user_cannot_update_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($admin, $tenant)['id'];

        $standardUser = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($standardUser)->putJson("/api/renewals/{$id}", [
            'title' => 'Updated by Standard',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_standard_user_with_can_edit_false_cannot_update(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($admin, $tenant)['id'];

        $readOnlyUser = $this->createTenantUser($tenant->id, canEdit: false);

        $response = $this->actingAs($readOnlyUser)->putJson("/api/renewals/{$id}", [
            'title' => 'Should fail',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Delete / Soft Delete ───────────────────────────────────────────────────

    public function test_tenant_admin_can_soft_delete_renewal(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($user, $tenant, ['title' => 'Delete Me', 'category' => 'contract'])['id'];

        $response = $this->actingAs($user)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('message', 'Renewal moved to recycle bin.');
    }

    public function test_standard_user_cannot_delete_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $id = $this->makeRenewal($admin, $tenant, ['title' => 'Protected'])['id'];

        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Search ─────────────────────────────────────────────────────────────────

    public function test_search_returns_matching_renewals(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Adobe Photoshop',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Microsoft Office',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?search=Adobe', $this->tenantHeaders($tenant));

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('Adobe Photoshop', $data[0]['title']);
    }

    public function test_search_escapes_like_metacharacters(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Normal Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        // Searching with % should not match everything.
        $response = $this->actingAs($user)->getJson('/api/renewals?search=%25', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    // ── Tenant isolation ───────────────────────────────────────────────────────

    public function test_user_cannot_access_other_tenants_renewals(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        // AdminA creates a renewal in tenantA.
        $id = $this->makeRenewal($adminA, $tenantA, ['title' => 'Tenant A Renewal'])['id'];

        // AdminB tries to update it using tenantB's context.
        $response = $this->actingAs($adminB)->putJson("/api/renewals/{$id}", [
            'title' => 'Should Not Update',
        ], $this->tenantHeaders($tenantB));

        $response->assertNotFound();
    }

    // ── Client integration ──────────────────────────────────────────────────

    public function test_create_renewal_with_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $clientId = $this->createClient($user, $tenant);

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Renewal with Client',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()->assertJsonPath('client_id', $clientId);
    }

    public function test_update_renewal_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $clientId = $this->createClient($user, $tenant, 'Client A');
        $client2Id = $this->createClient($user, $tenant, 'Client B');

        $id = $this->makeRenewal($user, $tenant, ['client_id' => $clientId])['id'];

        $response = $this->actingAs($user)->putJson("/api/renewals/{$id}", [
            'client_id' => $client2Id,
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('client_id', $client2Id);
    }

    public function test_index_eager_loads_client(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $clientId = $this->createClient($user, $tenant, 'Loaded Client');

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Renewal with Client',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals', $this->tenantHeaders($tenant));

        $response->assertOk();
        $data = $response->json('data.0');
        $this->assertSame('Loaded Client', $data['client']['name']);
    }

    public function test_search_by_client_name(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $client1Id = $this->createClient($user, $tenant, 'UniqueClientSearch');
        $client2Id = $this->createClient($user, $tenant, 'Other Client');

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Some Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $client1Id,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Other Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $client2Id,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?search=UniqueClientSearch', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    // ── Filters ─────────────────────────────────────────────────────────────

    public function test_filter_by_category(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'License Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Contract Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?category=license', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('License Renewal', $response->json('data.0.title'));
    }

    public function test_filter_by_workflow_status(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Active Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'workflow_status' => 'Active - paid and in force',
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Closed Renewal',
            'category' => 'contract',
            'expiration_date' => now()->subDays(10)->toDateString(),
            'workflow_status' => 'Closed',
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson(
            '/api/renewals?' . http_build_query(['workflow_status' => 'Active - paid and in force']),
            $this->tenantHeaders($tenant),
        );

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Active Renewal', $response->json('data.0.title'));
    }

    public function test_filter_by_auto_renews(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Auto Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'auto_renews' => true,
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Manual Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'auto_renews' => false,
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?auto_renews=1', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Auto Renewal', $response->json('data.0.title'));
    }

    public function test_filter_by_client_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $client1Id = $this->createClient($user, $tenant, 'Filter Client A');
        $client2Id = $this->createClient($user, $tenant, 'Filter Client B');

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'With Client A',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $client1Id,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'With Client B',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $client2Id,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson("/api/renewals?client_id={$client1Id}", $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('With Client A', $response->json('data.0.title'));
    }

    public function test_filter_by_expiry_preset_next_30_days(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Soon',
            'category' => 'contract',
            'expiration_date' => now()->addDays(15)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Far Away',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?expiry_preset=next_30_days', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Soon', $response->json('data.0.title'));
    }

    public function test_filter_by_expiry_preset_custom(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'In 2 Months',
            'category' => 'contract',
            'expiration_date' => now()->addMonths(2)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'In 6 Months',
            'category' => 'contract',
            'expiration_date' => now()->addMonths(6)->toDateString(),
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/renewals?expiry_preset=custom&expiry_months=3', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('In 2 Months', $response->json('data.0.title'));
    }

    public function test_combined_filters(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();
        $clientId = $this->createClient($user, $tenant);

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Match Both',
            'category' => 'license',
            'expiration_date' => now()->addDays(15)->toDateString(),
            'auto_renews' => true,
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Match Category Only',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
            'auto_renews' => false,
            'client_id' => $clientId,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson(
            '/api/renewals?category=license&auto_renews=1',
            $this->tenantHeaders($tenant),
        );

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Match Both', $response->json('data.0.title'));
    }
}
