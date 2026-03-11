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

    public function test_login_with_unknown_email_returns_422(): void
    {
        // This exercises the DUMMY_HASH path. A malformed dummy hash would throw
        // a RuntimeException here instead of returning a validation error.
        $response = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'irrelevant',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_login_with_wrong_password_returns_422(): void
    {
        User::query()->create([
            'name' => 'Auth User',
            'email' => 'auth2@example.com',
            'password' => Hash::make('CorrectPassword!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'auth2@example.com',
            'password' => 'WrongPassword!',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_login_response_does_not_expose_sensitive_fields(): void
    {
        User::query()->create([
            'name' => 'Auth User',
            'email' => 'auth3@example.com',
            'password' => Hash::make('Password123!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'auth3@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertOk();
        $this->assertArrayNotHasKey('password', $response->json('user'));
        $response->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'is_global_superadmin']]);
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

    public function test_superadmin_tenant_creation_requires_tenant_admin_payload(): void
    {
        $superadmin = User::query()->create([
            'name' => 'Superadmin User',
            'email' => 'super@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);

        $response = $this->actingAs($superadmin)->postJson('/api/superadmin/tenants', [
            'name' => 'Tenant 1',
            'slug' => 'tenant-1',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors([
            'tenant_admin.name',
            'tenant_admin.email',
            'tenant_admin.password',
        ]);
    }
}
