<?php

namespace Database\Seeders;

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $superadmin = User::query()->updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Global Superadmin',
                'password' => Hash::make('Superadmin123!'),
                'is_global_superadmin' => true,
            ],
        );

        $tenantAdmin = User::query()->updateOrCreate(
            ['email' => 'tenantadmin@example.com'],
            [
                'name' => 'Tenant Admin',
                'password' => Hash::make('Tenantadmin123!'),
                'is_global_superadmin' => false,
            ],
        );

        DB::table('tenants')->updateOrInsert(
            ['id' => '00000000-0000-0000-0000-000000000001'],
            [
                'name' => 'Acme Corp',
                'slug' => 'acme',
                'status' => 'active',
                'created_by' => $superadmin->id,
                'data' => json_encode([
                    'timezone' => 'Pacific/Auckland',
                    'ui_settings' => [
                        'theme_preset' => 'default',
                        'density' => 'comfortable',
                        'font_family' => 'modern_sans',
                        'primary_colour' => '#0f2747',
                        'secondary_colour' => '#2f3d50',
                        'tertiary_colour' => '#002c42',
                        'accent_colour' => '#002c42',
                        'border_colour' => '#6b7f93',
                    ],
                ]),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );

        $tenant = Tenant::query()->findOrFail('00000000-0000-0000-0000-000000000001');

        TenantMembership::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $tenantAdmin->id],
            ['role' => TenantRole::TenantAdmin->value, 'can_edit' => true],
        );
    }
}
