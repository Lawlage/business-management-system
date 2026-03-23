<?php

namespace Tests;

use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\TenantMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

trait CreatesTenantContext
{
    /**
     * Pool of tenant DB IDs shared across all tests in a single test class.
     * Avoids the expensive CREATE DATABASE + migrate cycle for every test method.
     *
     * Slot 0 = first tenant needed, slot 1 = second (for cross-tenant tests), etc.
     */
    private static array $tenantDbPool = [];

    /** Pre-computed bcrypt hash for 'Password123!' with rounds=4 (avoids hashing per test). */
    private static ?string $cachedPasswordHash = null;

    /** Cached tenant table names (populated once, reused for truncation). */
    private static ?array $tenantTableNames = null;

    /**
     * Cursor tracking how many tenant DBs the current test method has requested.
     * PHPUnit creates a fresh instance per test method, so this is always 0 at start.
     */
    private int $tenantDbCursor = 0;

    private function hashedPassword(): string
    {
        return static::$cachedPasswordHash ??= Hash::make('Password123!');
    }

    /**
     * Drop all shared tenant databases and their records after every test
     * in this class has finished.
     *
     * Uses raw DB calls because the Laravel app may be partially torn down
     * by the time @afterClass runs (especially under parallel testing).
     *
     * @afterClass
     */
    public static function dropSharedTenantDatabases(): void
    {
        foreach (static::$tenantDbPool as $tenantId) {
            try {
                DB::statement("DROP DATABASE IF EXISTS `tenant{$tenantId}`");
                DB::table('tenants')->where('id', $tenantId)->delete();
            } catch (\Throwable) {
                // Best-effort cleanup — DB may already be gone.
            }
        }
        static::$tenantDbPool = [];
        static::$cachedPasswordHash = null;
        static::$tenantTableNames = null;
    }

    protected function tearDown(): void
    {
        // End any active tenancy context so the next test starts clean.
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        parent::tearDown();
    }

    /**
     * Create a tenant admin user bound to a provisioned tenant.
     *
     * First call per pool slot creates the DB (expensive, once per class).
     * Subsequent calls reuse the DB and truncate tenant tables (fast).
     *
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantAdminContext(): array
    {
        $user = User::query()->create([
            'first_name' => 'Tenant',
            'last_name' => 'Admin',
            'email' => 'tenant-admin-' . Str::random(6) . '@example.com',
            'password' => $this->hashedPassword(),
            'is_global_superadmin' => false,
        ]);

        $slot = $this->tenantDbCursor++;

        if (!isset(static::$tenantDbPool[$slot])) {
            // First time this slot is needed: create DB normally (fires events → CreateDatabase + MigrateDatabase).
            $tenant = Tenant::query()->create([
                'id' => (string) Str::uuid(),
                'name' => 'Test Tenant',
                'slug' => 'test-' . Str::lower(Str::random(5)),
                'status' => 'active',
                'data' => ['timezone' => 'Pacific/Auckland'],
            ]);
            static::$tenantDbPool[$slot] = $tenant->id;
        } else {
            // Reuse existing DB. The Tenant record from the first test persists
            // (CREATE DATABASE DDL causes implicit commit in MySQL, so RefreshDatabase
            // cannot roll it back). Retrieve the existing record, or re-create
            // without events if it's missing.
            $tenantId = static::$tenantDbPool[$slot];
            $tenant = Tenant::query()->find($tenantId);

            if (!$tenant) {
                $tenant = Tenant::withoutEvents(function () use ($tenantId) {
                    return Tenant::query()->create([
                        'id' => $tenantId,
                        'name' => 'Test Tenant',
                        'slug' => 'test-' . Str::lower(Str::random(5)),
                        'status' => 'active',
                        'data' => ['timezone' => 'Pacific/Auckland'],
                    ]);
                });
            }

            // Truncate all tenant tables for a clean slate.
            $this->truncateTenantTables($tenant);
        }

        TenantMembership::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => TenantRole::TenantAdmin->value,
            'can_edit' => true,
        ]);

        return [$user, $tenant];
    }

    /**
     * Create a standard user bound to an existing tenant.
     */
    protected function createTenantUser(string $tenantId, TenantRole $role = TenantRole::StandardUser, bool $canEdit = true): User
    {
        $user = User::query()->create([
            'first_name' => 'Tenant',
            'last_name' => 'User',
            'email' => 'user-' . Str::random(6) . '@example.com',
            'password' => $this->hashedPassword(),
            'is_global_superadmin' => false,
        ]);

        TenantMembership::query()->create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => $role->value,
            'can_edit' => $canEdit,
        ]);

        return $user;
    }

    /**
     * Return the X-Tenant-Id header array for a given tenant.
     *
     * @return array<string, string>
     */
    protected function tenantHeaders(Tenant $tenant): array
    {
        return ['X-Tenant-Id' => $tenant->id];
    }

    /**
     * Create a tenant user flagged as an account manager and return that user.
     */
    protected function createAccountManager(string $tenantId, TenantRole $role = TenantRole::SubAdmin): User
    {
        $user = $this->createTenantUser($tenantId, $role);

        TenantMembership::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $user->id)
            ->update(['is_account_manager' => true]);

        return $user;
    }

    /**
     * Create a client via the API and return its id.
     */
    protected function createClient(User $user, Tenant $tenant, string $name = 'Test Client'): int
    {
        return (int) $this->actingAs($user)
            ->postJson('/api/clients', ['name' => $name], $this->tenantHeaders($tenant))
            ->assertCreated()
            ->json('id');
    }

    /**
     * Truncate all tables in the tenant database (except migrations).
     * Caches the table list to avoid SHOW TABLES on every call.
     */
    private function truncateTenantTables(Tenant $tenant): void
    {
        tenancy()->initialize($tenant);

        if (static::$tenantTableNames === null) {
            $tables = DB::connection('tenant')->select('SHOW TABLES');
            static::$tenantTableNames = [];
            foreach ($tables as $table) {
                $name = array_values((array) $table)[0];
                if ($name !== 'migrations') {
                    static::$tenantTableNames[] = $name;
                }
            }
        }

        if (!empty(static::$tenantTableNames)) {
            DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS = 0');
            foreach (static::$tenantTableNames as $tableName) {
                DB::connection('tenant')->table($tableName)->truncate();
            }
            DB::connection('tenant')->statement('SET FOREIGN_KEY_CHECKS = 1');
        }

        tenancy()->end();
    }
}
