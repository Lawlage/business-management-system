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
            'entity_type' => ['renewal'],
            'name' => 'Contract Number',
            'key' => 'contract_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['inventory'],
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
            'entity_type' => ['renewal'],
            'name' => 'Contract Number',
            'key' => 'contract_number',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['inventory'],
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
        $this->assertContains('renewal', $fields[0]['entity_type']);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_custom_field(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
            'name' => 'Supplier Contact',
            'key' => 'supplier_contact',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('entity_type.0', 'renewal')
            ->assertJsonPath('name', 'Supplier Contact')
            ->assertJsonPath('key', 'supplier_contact');
    }

    public function test_standard_user_cannot_create_custom_field(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
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
            'entity_type' => ['invalid_type'],
            'name' => 'Test',
            'key' => 'test',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['entity_type.0']);
    }

    public function test_create_requires_valid_field_type(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
            'name' => 'Test',
            'key' => 'test',
            'field_type' => 'invalid_type',
            'is_required' => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['field_type']);
    }

    // ── Dropdown type ──────────────────────────────────────────────────────────

    public function test_can_create_dropdown_custom_field_with_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
            'name' => 'Priority',
            'key' => 'priority',
            'field_type' => 'dropdown',
            'is_required' => false,
            'validation_rules' => [],
            'dropdown_options' => ['Low', 'Medium', 'High'],
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('field_type', 'dropdown')
            ->assertJsonPath('dropdown_options.0', 'Low')
            ->assertJsonPath('dropdown_options.2', 'High');
    }

    public function test_dropdown_field_requires_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
            'name' => 'Status',
            'key' => 'status_dropdown',
            'field_type' => 'dropdown',
            'is_required' => false,
            'validation_rules' => [],
            'dropdown_options' => [],
        ], $this->tenantHeaders($tenant))->assertUnprocessable();
    }

    public function test_non_dropdown_field_ignores_dropdown_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
            'name' => 'Notes',
            'key' => 'extra_notes',
            'field_type' => 'text',
            'is_required' => false,
            'validation_rules' => [],
            'dropdown_options' => ['A', 'B'],
        ], $this->tenantHeaders($tenant));

        $response->assertCreated();
        $this->assertNull($response->json('dropdown_options'));
    }

    // ── Update dropdown options ─────────────────────────────────────────────────

    public function test_update_replaces_dropdown_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type'      => ['renewal'],
            'name'             => 'Priority',
            'key'              => 'priority',
            'field_type'       => 'dropdown',
            'is_required'      => false,
            'validation_rules' => [],
            'dropdown_options' => ['Low', 'Medium', 'High'],
        ], $this->tenantHeaders($tenant));

        $create->assertCreated();
        $id = $create->json('id');

        $response = $this->actingAs($user)->putJson("/api/custom-fields/{$id}", [
            'name'             => 'Priority',
            'entity_type'      => ['renewal'],
            'dropdown_options' => ['Low', 'Medium', 'High', 'Critical'],
        ], $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertCount(4, $response->json('dropdown_options'));
        $this->assertContains('Critical', $response->json('dropdown_options'));
    }

    public function test_update_dropdown_field_rejects_empty_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type'      => ['renewal'],
            'name'             => 'Status',
            'key'              => 'status_field',
            'field_type'       => 'dropdown',
            'is_required'      => false,
            'validation_rules' => [],
            'dropdown_options' => ['Open', 'Closed'],
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $this->actingAs($user)->putJson("/api/custom-fields/{$id}", [
            'name'             => 'Status',
            'entity_type'      => ['renewal'],
            'dropdown_options' => [],
        ], $this->tenantHeaders($tenant))->assertUnprocessable();
    }

    public function test_update_non_dropdown_field_ignores_dropdown_options(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type'      => ['renewal'],
            'name'             => 'Extra Notes',
            'key'              => 'extra_notes_2',
            'field_type'       => 'text',
            'is_required'      => false,
            'validation_rules' => [],
        ], $this->tenantHeaders($tenant));

        $id = $create->json('id');

        $response = $this->actingAs($user)->putJson("/api/custom-fields/{$id}", [
            'name'             => 'Extra Notes',
            'entity_type'      => ['renewal'],
            'dropdown_options' => ['A', 'B'],
        ], $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertNull($response->json('dropdown_options'));
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_delete_custom_field(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $create = $this->actingAs($user)->postJson('/api/custom-fields', [
            'entity_type' => ['renewal'],
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
