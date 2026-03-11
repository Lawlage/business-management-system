<?php

namespace Tests\Feature;

use App\Models\BreakGlassAccess;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\CreatesTenantContext;
use Tests\TestCase;

class BreakGlassControllerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesTenantContext;

    private function makeSuperadmin(): User
    {
        return User::query()->create([
            'name' => 'Superadmin',
            'email' => 'super-' . Str::random(5) . '@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => true,
        ]);
    }

    // ── Start break-glass ──────────────────────────────────────────────────────

    public function test_superadmin_can_start_break_glass_session(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Emergency incident response needed', 'permission_confirmed' => true]
        );

        $response->assertCreated()
            ->assertJsonStructure(['token', 'expires_at']);

        // The returned token should be a UUID string (plaintext).
        $token = $response->json('token');
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $token);
    }

    public function test_token_is_stored_as_hash_not_plaintext(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Audit investigation required', 'permission_confirmed' => true]
        );

        $plaintext = $response->json('token');

        // The token stored in the DB must be the SHA-256 hash, not the plaintext.
        $hash = hash('sha256', $plaintext);
        $this->assertDatabaseHas('break_glass_accesses', ['token' => $hash]);
        $this->assertDatabaseMissing('break_glass_accesses', ['token' => $plaintext]);
    }

    public function test_break_glass_requires_reason_of_at_least_ten_characters(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Short', 'permission_confirmed' => true]
        );

        $response->assertUnprocessable()->assertJsonValidationErrors(['reason']);
    }

    public function test_break_glass_requires_permission_confirmed(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Emergency access required', 'permission_confirmed' => false]
        );

        $response->assertUnprocessable()->assertJsonValidationErrors(['permission_confirmed']);
    }

    public function test_non_superadmin_cannot_start_break_glass(): void
    {
        [$admin, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($admin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Emergency access required', 'permission_confirmed' => true]
        );

        $response->assertForbidden();
    }

    // ── Stop break-glass ───────────────────────────────────────────────────────

    public function test_superadmin_can_stop_break_glass_session(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $start = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass",
            ['reason' => 'Emergency incident response', 'permission_confirmed' => true]
        );

        $token = $start->json('token');

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass/{$token}/stop"
        );

        $response->assertOk()->assertJsonPath('message', 'Break-glass session closed.');

        // The ended_at field should now be set.
        $hash = hash('sha256', $token);
        $this->assertDatabaseHas('break_glass_accesses', [
            'token' => $hash,
            'tenant_id' => $tenant->id,
        ]);

        $access = BreakGlassAccess::query()->where('token', $hash)->first();
        $this->assertNotNull($access->ended_at);
    }

    public function test_stop_with_wrong_token_returns_404(): void
    {
        [, $tenant] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenant->id}/break-glass/fake-token-value/stop"
        );

        $response->assertNotFound();
    }

    public function test_stop_with_wrong_tenant_returns_404(): void
    {
        [, $tenantA] = $this->createTenantAdminContext();
        [, $tenantB] = $this->createTenantAdminContext();
        $superadmin = $this->makeSuperadmin();

        $start = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenantA->id}/break-glass",
            ['reason' => 'Emergency incident response', 'permission_confirmed' => true]
        );

        $token = $start->json('token');

        // Try to stop the session using tenantB's ID.
        $response = $this->actingAs($superadmin)->postJson(
            "/api/superadmin/tenants/{$tenantB->id}/break-glass/{$token}/stop"
        );

        $response->assertNotFound();
    }
}
