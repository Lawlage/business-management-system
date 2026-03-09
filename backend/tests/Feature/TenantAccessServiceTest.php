<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
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
}
