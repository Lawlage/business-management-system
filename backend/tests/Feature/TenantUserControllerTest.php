<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class TenantUserControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    // ── List ───────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_list_users(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/tenant-users', $this->tenantHeaders($tenant));

        $response->assertOk();
        $this->assertIsArray($response->json());
    }

    public function test_standard_user_cannot_list_users(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($user)->getJson('/api/tenant-users', $this->tenantHeaders($tenant));

        $response->assertForbidden();
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_create_user(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($admin)->postJson('/api/tenant-users', [
            'first_name' => 'New',
            'last_name' => 'Member',
            'email' => 'member@example.com',
            'password' => 'StrongPass1!',
            'role' => TenantRole::StandardUser->value,
        ], $this->tenantHeaders($tenant));

        $response->assertCreated()
            ->assertJsonPath('email', 'member@example.com');

        $this->assertDatabaseHas('tenant_memberships', [
            'tenant_id' => $tenant->id,
            'role' => TenantRole::StandardUser->value,
        ]);
    }

    public function test_create_user_requires_password_complexity(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($admin)->postJson('/api/tenant-users', [
            'first_name' => 'New',
            'last_name' => 'Member',
            'email' => 'weak@example.com',
            'password' => 'weakpassword',
            'role' => TenantRole::StandardUser->value,
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['password']);
    }

    public function test_create_user_rejects_duplicate_email(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $this->actingAs($admin)->postJson('/api/tenant-users', [
            'first_name' => 'First',
            'last_name' => 'User',
            'email' => 'dupe@example.com',
            'password' => 'Password123!',
            'role' => TenantRole::StandardUser->value,
        ], $this->tenantHeaders($tenant));

        $response = $this->actingAs($admin)->postJson('/api/tenant-users', [
            'first_name' => 'Second',
            'last_name' => 'User',
            'email' => 'dupe@example.com',
            'password' => 'Password123!',
            'role' => TenantRole::StandardUser->value,
        ], $this->tenantHeaders($tenant));

        $response->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }

    // ── Remove ─────────────────────────────────────────────────────────────────

    public function test_tenant_admin_can_remove_user(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($admin)->deleteJson(
            "/api/tenant-users/{$user->id}",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'User removed from tenant.');

        $this->assertDatabaseMissing('tenant_memberships', [
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_tenant_admin_cannot_delete_own_account(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($admin)->deleteJson(
            "/api/tenant-users/{$admin->id}",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertUnprocessable()->assertJsonPath('message', 'You cannot delete your own account.');
    }

    public function test_remove_returns_404_for_user_not_in_tenant(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $outsider = User::query()->create([
            'first_name' => 'Out',
            'last_name' => 'Sider',
            'email' => 'outsider@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $response = $this->actingAs($admin)->deleteJson(
            "/api/tenant-users/{$outsider->id}",
            [],
            $this->tenantHeaders($tenant)
        );

        $response->assertNotFound();
    }

    // ── Reset Password ─────────────────────────────────────────────────────────

    public function test_tenant_admin_can_reset_user_password(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($admin)->postJson(
            "/api/tenant-users/{$user->id}/reset-password",
            ['password' => 'NewPassword1!'],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk()->assertJsonPath('message', 'Password reset.');
        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword1!', $user->password));
    }

    public function test_reset_password_enforces_tenant_scope(): void
    {
        [$adminA, $tenantA] = $this->createTenantAdminContext();
        [$adminB, $tenantB] = $this->createTenantAdminContext();

        // userB belongs to tenantB only.
        $userB = $this->createTenantUser($tenantB->id);

        // AdminA (in tenantA context) tries to reset userB's password.
        $response = $this->actingAs($adminA)->postJson(
            "/api/tenant-users/{$userB->id}/reset-password",
            ['password' => 'NewPassword1!'],
            $this->tenantHeaders($tenantA)
        );

        $response->assertNotFound();
    }

    public function test_reset_password_enforces_complexity(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id);

        $response = $this->actingAs($admin)->postJson(
            "/api/tenant-users/{$user->id}/reset-password",
            ['password' => 'weakpassword'],
            $this->tenantHeaders($tenant)
        );

        $response->assertUnprocessable()->assertJsonValidationErrors(['password']);
    }

    // ── Update Membership ──────────────────────────────────────────────────────

    public function test_tenant_admin_can_toggle_can_edit(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();
        $user = $this->createTenantUser($tenant->id, TenantRole::StandardUser, true);

        $response = $this->actingAs($admin)->putJson(
            "/api/tenant-users/{$user->id}",
            ['can_edit' => false],
            $this->tenantHeaders($tenant)
        );

        $response->assertOk();

        $this->assertDatabaseHas('tenant_memberships', [
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'can_edit' => false,
        ]);
    }
}
