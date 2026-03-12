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
                'first_name' => 'Global',
                'last_name' => 'Superadmin',
                'password' => Hash::make('Superadmin123!'),
                'is_global_superadmin' => true,
            ],
        );

        $tenantAdmin = User::query()->updateOrCreate(
            ['email' => 'tenantadmin@example.com'],
            [
                'first_name' => 'Tenant',
                'last_name' => 'Admin',
                'password' => Hash::make('Tenantadmin123!'),
                'is_global_superadmin' => false,
            ],
        );

        // Use firstOrCreate (not DB::table) so Eloquent model events fire and
        // stancl/tenancy's CreateDatabase pipeline runs on first seed.
        $tenant = Tenant::firstOrCreate(
            ['id' => '00000000-0000-0000-0000-000000000001'],
            [
                'name' => 'Acme Corp',
                'slug' => 'acme',
                'status' => 'active',
                'created_by' => $superadmin->id,
                'data' => [
                    'timezone' => 'Pacific/Auckland',
                    'ui_settings' => [
                        'theme_preset' => 'default',
                        'density' => 'comfortable',
                        'font_family' => 'modern_sans',
                        'primary_colour' => '#0f172a',
                        'secondary_colour' => '#1e293b',
                        'tertiary_colour' => '#4b5563',
                        'accent_colour' => '#4b5563',
                        'border_colour' => '#5f738a',
                    ],
                ],
            ],
        );

        TenantMembership::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'user_id' => $tenantAdmin->id],
            ['role' => TenantRole::TenantAdmin->value, 'can_edit' => true],
        );

        // Seed tenant-scoped data inside the tenant database.
        tenancy()->initialize($tenant);
        try {
            DB::connection('tenant')->table('clients')->insertOrIgnore([
                [
                    'id' => 1,
                    'name' => 'Acme Industries',
                    'contact_name' => 'John Smith',
                    'email' => 'john@acme-industries.example.com',
                    'phone' => '+64 21 555 0100',
                    'website' => 'https://acme-industries.example.com',
                    'notes' => 'Primary manufacturing partner.',
                    'created_by' => $tenantAdmin->id,
                    'updated_by' => $tenantAdmin->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                    'deleted_at' => null,
                ],
                [
                    'id' => 2,
                    'name' => 'Globex Corporation',
                    'contact_name' => 'Jane Doe',
                    'email' => 'jane@globex.example.com',
                    'phone' => '+64 21 555 0200',
                    'website' => 'https://globex.example.com',
                    'notes' => null,
                    'created_by' => $tenantAdmin->id,
                    'updated_by' => $tenantAdmin->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                    'deleted_at' => null,
                ],
            ]);

            DB::connection('tenant')->table('inventory_items')->insertOrIgnore([
                [
                    'id' => 1,
                    'name' => 'Office Chair',
                    'sku' => 'CHAIR-001',
                    'classification' => 'Furniture',
                    'quantity_on_hand' => 8,
                    'minimum_on_hand' => 2,
                    'location' => 'Warehouse A',
                    'vendor' => 'Office Supplies Co.',
                    'purchase_date' => '2025-01-15',
                    'linked_renewal_id' => null,
                    'notes' => 'Ergonomic mesh chairs.',
                    'created_by' => $tenantAdmin->id,
                    'updated_by' => $tenantAdmin->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                    'deleted_at' => null,
                ],
                [
                    'id' => 2,
                    'name' => 'Laptop - Dell XPS 15',
                    'sku' => 'LAPTOP-DXPS15',
                    'classification' => 'Electronics',
                    'quantity_on_hand' => 3,
                    'minimum_on_hand' => 1,
                    'location' => 'IT Storage',
                    'vendor' => 'Dell Technologies',
                    'purchase_date' => '2025-06-01',
                    'linked_renewal_id' => null,
                    'notes' => null,
                    'created_by' => $tenantAdmin->id,
                    'updated_by' => $tenantAdmin->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                    'deleted_at' => null,
                ],
            ]);

            DB::connection('tenant')->table('stock_allocations')->insertOrIgnore([
                [
                    'id' => 1,
                    'inventory_item_id' => 1,
                    'client_id' => 1,
                    'quantity' => 2,
                    'unit_price' => 299.00,
                    'notes' => 'Supplied for new office setup.',
                    'status' => 'allocated',
                    'allocated_by' => $tenantAdmin->id,
                    'cancelled_by' => null,
                    'cancelled_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        } finally {
            tenancy()->end();
        }
    }
}
