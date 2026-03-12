<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class RenewalControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

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

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Adobe Acrobat License',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('title', 'Adobe Acrobat License')
            ->assertJsonPath('status', 'No action needed');
    }

    public function test_status_is_auto_calculated_on_create(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Urgent Renewal',
            'category' => 'contract',
            'expiration_date' => now()->addDays(3)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()->assertJsonPath('status', 'Urgent');
    }

    public function test_standard_user_cannot_create_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Test',
            'category' => 'license',
            'expiration_date' => now()->addDays(30)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_create_renewal_requires_title_and_category_and_expiration_date(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/renewals', [], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['title', 'category', 'expiration_date']);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_update_renewal(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Old Title',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

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

        $create = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Test Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->putJson("/api/renewals/{$id}", [
            'expiration_date' => now()->addDays(3)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('status', 'Urgent');
    }

    public function test_standard_user_cannot_update_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($admin)->postJson('/api/renewals', [
            'title' => 'Test',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $standardUser = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($standardUser)->putJson("/api/renewals/{$id}", [
            'title' => 'Updated by Standard',
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_standard_user_with_can_edit_false_cannot_update(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($admin)->postJson('/api/renewals', [
            'title' => 'Test',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

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

        $create = $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Delete Me',
            'category' => 'contract',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertOk()->assertJsonPath('message', 'Renewal moved to recycle bin.');
    }

    public function test_standard_user_cannot_delete_renewal(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($admin)->postJson('/api/renewals', [
            'title' => 'Protected',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->deleteJson("/api/renewals/{$id}", [], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Search ─────────────────────────────────────────────────────────────────

    public function test_search_returns_matching_renewals(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Adobe Photoshop',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Microsoft Office',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
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

        $this->actingAs($user)->postJson('/api/renewals', [
            'title' => 'Normal Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
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
        $create = $this->actingAs($adminA)->postJson('/api/renewals', [
            'title' => 'Tenant A Renewal',
            'category' => 'license',
            'expiration_date' => now()->addDays(90)->toDateString(),
        ], $this->tenantHeaders($tenantA));

        $id = $create->json('id');

        // AdminB tries to update it using tenantB's context.
        $response = $this->actingAs($adminB)->putJson("/api/renewals/{$id}", [
            'title' => 'Should Not Update',
        ], $this->tenantHeaders($tenantB));

        $response->assertNotFound();
    }
}
