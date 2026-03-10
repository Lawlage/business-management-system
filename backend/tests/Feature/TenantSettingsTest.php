<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_view_tenant_settings_with_ui_defaults(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->getJson('/api/tenant-settings', [
            'X-Tenant-Id' => $tenant->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('timezone', 'Pacific/Auckland')
            ->assertJsonPath('ui_settings.theme_preset', 'default')
            ->assertJsonPath('ui_settings.density', 'comfortable')
            ->assertJsonPath('ui_settings.font_family', 'modern_sans')
            ->assertJsonPath('ui_settings.primary_colour', '#0f2747')
            ->assertJsonPath('ui_settings.secondary_colour', '#2f3d50')
            ->assertJsonPath('ui_settings.tertiary_colour', '#002c42')
            ->assertJsonPath('ui_settings.border_colour', '#6b7f93');
    }

    public function test_tenant_admin_can_update_ui_settings_and_timezone(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->putJson('/api/tenant-settings', [
            'timezone' => 'Pacific/Auckland',
            'ui_settings' => [
                'theme_preset' => 'high_contrast',
                'density' => 'compact',
                'font_family' => 'modern_sans',
                'primary_colour' => '#123456',
                'secondary_colour' => '#234567',
                'tertiary_colour' => '#345678',
                'accent_colour' => '#1d4ed8',
                'border_colour' => '#89abcd',
            ],
        ], [
            'X-Tenant-Id' => $tenant->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('timezone', 'Pacific/Auckland')
            ->assertJsonPath('ui_settings.theme_preset', 'high_contrast')
            ->assertJsonPath('ui_settings.density', 'compact')
            ->assertJsonPath('ui_settings.font_family', 'modern_sans')
            ->assertJsonPath('ui_settings.primary_colour', '#123456')
            ->assertJsonPath('ui_settings.secondary_colour', '#234567')
            ->assertJsonPath('ui_settings.tertiary_colour', '#345678')
            ->assertJsonPath('ui_settings.accent_colour', '#345678')
            ->assertJsonPath('ui_settings.border_colour', '#89abcd');

        $this->actingAs($user)->getJson('/api/tenant-settings', [
            'X-Tenant-Id' => $tenant->id,
        ])
            ->assertOk()
            ->assertJsonPath('timezone', 'Pacific/Auckland')
            ->assertJsonPath('ui_settings.theme_preset', 'high_contrast')
            ->assertJsonPath('ui_settings.primary_colour', '#123456')
            ->assertJsonPath('ui_settings.secondary_colour', '#234567')
            ->assertJsonPath('ui_settings.tertiary_colour', '#345678')
            ->assertJsonPath('ui_settings.accent_colour', '#345678')
            ->assertJsonPath('ui_settings.border_colour', '#89abcd');

    }

    public function test_tenant_settings_reject_invalid_color_tokens(): void
    {
        [$user, $tenant] = $this->createTenantAdminContext();

        $response = $this->actingAs($user)->putJson('/api/tenant-settings', [
            'timezone' => 'UTC',
            'ui_settings' => [
                'accent_colour' => 'blue',
            ],
        ], [
            'X-Tenant-Id' => $tenant->id,
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['ui_settings.accent_colour']);
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    private function createTenantAdminContext(): array
    {
        $user = User::query()->create([
            'name' => 'Tenant Admin',
            'email' => 'tenant-admin-'.Str::lower(Str::random(6)).'@example.com',
            'password' => bcrypt('Password123!'),
            'is_global_superadmin' => false,
        ]);

        $tenant = Tenant::query()->create([
            'id' => (string) Str::uuid(),
            'name' => 'Orchid Fabrication',
            'slug' => 'orchid-'.Str::lower(Str::random(5)),
            'status' => 'active',
            'data' => [
                'timezone' => 'Pacific/Auckland',
            ],
        ]);

        TenantMembership::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => TenantRole::TenantAdmin->value,
            'can_edit' => true,
        ]);

        return [$user, $tenant];
    }
}
