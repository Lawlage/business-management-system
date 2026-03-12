<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class CustomFieldControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── Index ──────────────────────────────────────────────────────────────────

    public function test_custom_fields_index_returns_all_entity_types_when_unfiltered(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Contract Number',
            'key' => 'contract_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'inventory',
            'name' => 'Serial Number',
            'key' => 'serial_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson('/api/custom-fields', $this->tenantHeaders($tenant));

        $response->assertOk();
        $fields = $response->json();
        $this->assertCount(2, $fields);
    }

    public function test_custom_fields_index_can_filter_by_entity_type(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Contract Number',
            'key' => 'contract_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'inventory',
            'name' => 'Serial Number',
            'key' => 'serial_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($user)->getJson(
            '/api/custom-fields?entity_type=renewal',
            $this->tenantHeaders($tenant)
        );

        $response->assertOk();
        $fields = $response->json();
        $this->assertCount(1, $fields);
        $this->assertSame('renewal', $fields[0]['entity_type']);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_custom_field(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Supplier Contact',
            'key' => 'supplier_contact',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('entity_type', 'renewal')
            ->assertJsonPath('name', 'Supplier Contact')
            ->assertJsonPath('key', 'supplier_contact');
    }

    public function test_standard_user_cannot_create_custom_field(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Test Field',
            'key' => 'test_field',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    public function test_create_requires_valid_entity_type(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'invalid_type',
            'name' => 'Test',
            'key' => 'test',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['entity_type']);
    }

    public function test_create_requires_valid_field_type(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Test',
            'key' => 'test',
            'field_type' => 'invalid_type',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['field_type']);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_custom_field(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => 'renewal',
            'name' => 'Deletable Field',
            'key' => 'deletable_field',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->deleteJson(
            "/api/custom-fields/{$id}",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Custom field moved to recycle bin.');
    }
}
