<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthAndSuperadminTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_and_get_token(): void
    {
        User::query()->create([
            'name' => 'Auth User',
            'email' => 'auth@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'auth@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'email']]);
    }

    public function test_non_superadmin_cannot_create_tenant(): void
    {
        $user = User::query()->create([
            'name' => 'Regular User',
            'email' => 'regular@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => false,
        ]);

        $response = $this->actingAs($user)->postJson('/api/superadmin/tenants', [
            'name' => 'Tenant 1',
            'slug' => 'tenant-1',
        ]);

        $response->assertForbidden();
    }
}
