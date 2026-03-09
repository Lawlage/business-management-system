<?php

namespace App\Providers;

use App\Models\GlobalAuditLog;
use App\Models\TenantAuditLog;
use LogicException;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        GlobalAuditLog::updating(fn () => throw new LogicException('Global audit logs are immutable.'));
        GlobalAuditLog::deleting(fn () => throw new LogicException('Global audit logs are immutable.'));

        TenantAuditLog::updating(fn () => throw new LogicException('Tenant audit logs are immutable.'));
        TenantAuditLog::deleting(fn () => throw new LogicException('Tenant audit logs are immutable.'));
    }
}
