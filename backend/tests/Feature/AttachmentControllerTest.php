<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class AttachmentControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    // ── List ───────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_attachments_for_entity(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->getJson('/api/attachments/renewal/1', $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonStructure([]);
    }

    public function test_invalid_entity_type_returns_422(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->getJson('/api/attachments/invalid_type/1', $this->tenantHeaders($tenant))
            ->assertUnprocessable();
    }

    // ── Upload ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_upload_attachment(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, \App\Enums\TenantRole::SubAdmin);

        $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

        $response = $this->actingAs($user)->postJson('/api/attachments', [
            'file' => $file,
            'entity_type' => 'renewal',
            'entity_id' => 1,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('original_name', 'contract.pdf');
    }

    public function test_standard_user_cannot_upload_attachment(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');

        $this->actingAs($user)->postJson('/api/attachments', [
            'file' => $file,
            'entity_type' => 'renewal',
            'entity_id' => 1,
        ], $this->tenantHeaders($tenant))->assertForbidden();
    }

    public function test_upload_rejects_invalid_entity_type(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');

        $this->actingAs($user)->postJson('/api/attachments', [
            'file' => $file,
            'entity_type' => 'forbidden_type',
            'entity_id' => 1,
        ], $this->tenantHeaders($tenant))->assertUnprocessable();
    }

    public function test_upload_requires_file_entity_type_and_entity_id(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($user)->postJson('/api/attachments', [], $this->tenantHeaders($tenant))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file', 'entity_type', 'entity_id']);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public function test_sub_admin_can_delete_attachment(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, \App\Enums\TenantRole::SubAdmin);

        $file = UploadedFile::fake()->create('todelete.pdf', 100, 'application/pdf');

        $attachment = $this->actingAs($admin)->postJson('/api/attachments', [
            'file' => $file,
            'entity_type' => 'client',
            'entity_id' => 1,
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->deleteJson("/api/attachments/{$attachment['id']}", [], $this->tenantHeaders($tenant))
            ->assertOk()
            ->assertJsonPath('message', 'Attachment deleted.');
    }

    // ── Download ───────────────────────────────────────────────────────────────

    public function test_any_tenant_member_can_download_attachment(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $file = UploadedFile::fake()->create('report.pdf', 50, 'application/pdf');

        $attachment = $this->actingAs($admin)->postJson('/api/attachments', [
            'file' => $file,
            'entity_type' => 'renewal',
            'entity_id' => 1,
        ], $this->tenantHeaders($tenant))->json();

        $this->actingAs($user)->get("/api/attachments/{$attachment['id']}/download", $this->tenantHeaders($tenant))
            ->assertOk();
    }
}
