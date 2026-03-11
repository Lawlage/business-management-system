<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use App\Models\BreakGlassAccess;
use App\Models\TenantMembership;
use App\Models\User;
use App\Services\TenantAccessService;
use App\Support\TenantPermissionMap;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TenantAccessServiceTest extends TestCase
{
    use RefreshDatabase;

    // ── hasTenantAccess ────────────────────────────────────────────────────────

    public function test_standard_user_cannot_create_renewals(): void
    {
        $user = User::query()->create([
            'name' => 'Standard User',
            'email' => 'standard@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        TenantMembership::query()->create([
            'tenant_id' => 'tenant-a',
            'user_id' => $user->id,
            'role' => TenantRole::StandardUser->value,
            'can_edit' => true,
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasPermission($user, 'tenant-a', TenantPermissionMap::CREATE_RENEWAL));
        $this->assertTrue($service->hasPermission($user, 'tenant-a', TenantPermissionMap::EDIT_EXISTING));
    }

    public function test_tenant_admin_can_manage_users(): void
    {
        $user = User::query()->create([
            'name' => 'Tenant Admin',
            'email' => 'tenant-admin@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        TenantMembership::query()->create([
            'tenant_id' => 'tenant-b',
            'user_id' => $user->id,
            'role' => TenantRole::TenantAdmin->value,
            'can_edit' => true,
        ]);

        $service = app(TenantAccessService::class);

        $this->assertTrue($service->hasPermission($user, 'tenant-b', TenantPermissionMap::MANAGE_USERS));
    }

    public function test_sub_admin_can_create_renewals_and_inventory_but_not_manage_users(): void
    {
        $user = User::query()->create([
            'name' => 'Sub Admin',
            'email' => 'sub-admin@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        TenantMembership::query()->create([
            'tenant_id' => 'tenant-c',
            'user_id' => $user->id,
            'role' => TenantRole::SubAdmin->value,
            'can_edit' => true,
        ]);

        $service = app(TenantAccessService::class);

        $this->assertTrue($service->hasPermission($user, 'tenant-c', TenantPermissionMap::CREATE_RENEWAL));
        $this->assertTrue($service->hasPermission($user, 'tenant-c', TenantPermissionMap::CREATE_INVENTORY));
        $this->assertFalse($service->hasPermission($user, 'tenant-c', TenantPermissionMap::MANAGE_USERS));
        $this->assertFalse($service->hasPermission($user, 'tenant-c', TenantPermissionMap::DELETE_RECORD));
    }

    public function test_can_edit_false_blocks_edit_existing_permission(): void
    {
        $user = User::query()->create([
            'name' => 'Read Only',
            'email' => 'readonly@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        TenantMembership::query()->create([
            'tenant_id' => 'tenant-d',
            'user_id' => $user->id,
            'role' => TenantRole::StandardUser->value,
            'can_edit' => false,
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasPermission($user, 'tenant-d', TenantPermissionMap::EDIT_EXISTING));
    }

    public function test_user_with_no_membership_has_no_access(): void
    {
        $user = User::query()->create([
            'name' => 'Outsider',
            'email' => 'outsider@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasTenantAccess($user, 'tenant-e'));
        $this->assertFalse($service->hasPermission($user, 'tenant-e', TenantPermissionMap::EDIT_EXISTING));
    }

    // ── Break-glass ────────────────────────────────────────────────────────────

    public function test_superadmin_with_valid_break_glass_has_access(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin',
            'email' => 'super@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $plaintext = 'test-token-value-123';
        $hash = hash('sha256', $plaintext);

        BreakGlassAccess::query()->create([
            'token' => $hash,
            'tenant_id' => 'tenant-f',
            'user_id' => $superadmin->id,
            'reason' => 'Emergency access',
            'permission_confirmed' => true,
            'expires_at' => now()->addMinutes(30),
        ]);

        $service = app(TenantAccessService::class);

        $this->assertTrue($service->hasTenantAccess($superadmin, 'tenant-f', $plaintext));
        $this->assertTrue($service->hasPermission($superadmin, 'tenant-f', TenantPermissionMap::DELETE_RECORD, $plaintext));
    }

    public function test_superadmin_without_break_glass_token_has_no_access(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin',
            'email' => 'super2@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasTenantAccess($superadmin, 'tenant-g'));
    }

    public function test_expired_break_glass_token_has_no_access(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin Expired',
            'email' => 'super3@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $plaintext = 'expired-token';
        $hash = hash('sha256', $plaintext);

        BreakGlassAccess::query()->create([
            'token' => $hash,
            'tenant_id' => 'tenant-h',
            'user_id' => $superadmin->id,
            'reason' => 'Old session',
            'permission_confirmed' => true,
            'expires_at' => now()->subMinutes(5),
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasTenantAccess($superadmin, 'tenant-h', $plaintext));
    }

    public function test_ended_break_glass_token_has_no_access(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin Ended',
            'email' => 'super4@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $plaintext = 'ended-token';
        $hash = hash('sha256', $plaintext);

        BreakGlassAccess::query()->create([
            'token' => $hash,
            'tenant_id' => 'tenant-i',
            'user_id' => $superadmin->id,
            'reason' => 'Ended session',
            'permission_confirmed' => true,
            'expires_at' => now()->addMinutes(30),
            'ended_at' => now()->subMinutes(2),
        ]);

        $service = app(TenantAccessService::class);

        $this->assertFalse($service->hasTenantAccess($superadmin, 'tenant-i', $plaintext));
    }

    public function test_wrong_tenant_break_glass_token_denied(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin Wrong',
            'email' => 'super5@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $plaintext = 'token-for-other-tenant';
        $hash = hash('sha256', $plaintext);

        BreakGlassAccess::query()->create([
            'token' => $hash,
            'tenant_id' => 'tenant-x',
            'user_id' => $superadmin->id,
            'reason' => 'Other tenant',
            'permission_confirmed' => true,
            'expires_at' => now()->addMinutes(30),
        ]);

        $service = app(TenantAccessService::class);

        // Token belongs to tenant-x, not tenant-j.
        $this->assertFalse($service->hasTenantAccess($superadmin, 'tenant-j', $plaintext));
    }
}
