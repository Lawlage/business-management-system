<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\BreakGlassController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CustomFieldController;
use App\Http\Controllers\Api\CustomFieldValueController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\RecycleBinController;
use App\Http\Controllers\Api\RenewalController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StockAllocationController;
use App\Http\Controllers\Api\SuperAdminTenantController;
use App\Http\Controllers\Api\TenantSettingsController;
use App\Http\Controllers\Api\TenantUserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Login is rate-limited to 6 attempts per minute per IP to prevent brute-force.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPasswordViaToken']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/password', [AuthController::class, 'changePassword']);

    Route::prefix('superadmin')->middleware('superadmin')->group(function (): void {
        Route::get('/tenants', [SuperAdminTenantController::class, 'index']);
        Route::post('/tenants', [SuperAdminTenantController::class, 'store']);
        Route::delete('/tenants/{tenantId}', [SuperAdminTenantController::class, 'destroy']);
        Route::post('/tenants/{tenantId}/suspend', [SuperAdminTenantController::class, 'suspend']);
        Route::post('/tenants/{tenantId}/unsuspend', [SuperAdminTenantController::class, 'unsuspend']);
        Route::post('/tenants/{tenantId}/assign-tenant-admin', [SuperAdminTenantController::class, 'assignTenantAdmin']);
        Route::post('/tenants/{tenantId}/break-glass', [BreakGlassController::class, 'start']);
        Route::post('/tenants/{tenantId}/break-glass/{token}/stop', [BreakGlassController::class, 'stop']);
        Route::get('/audit-logs', [SuperAdminTenantController::class, 'auditLogs']);
        Route::get('/users', [SuperAdminTenantController::class, 'users']);
    });

    Route::middleware('tenant.context')->group(function (): void {
        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::get('/clients', [ClientController::class, 'index']);
        Route::post('/clients', [ClientController::class, 'store'])->middleware('tenant.permission:create_client');
        Route::put('/clients/{id}', [ClientController::class, 'update'])->middleware('tenant.permission:edit_existing');
        Route::delete('/clients/{id}', [ClientController::class, 'destroy'])->middleware('tenant.permission:delete_record');

        Route::get('/renewals', [RenewalController::class, 'index']);
        Route::post('/renewals', [RenewalController::class, 'store'])->middleware('tenant.permission:create_renewal');
        Route::put('/renewals/{id}', [RenewalController::class, 'update'])->middleware('tenant.permission:edit_existing');
        Route::delete('/renewals/{id}', [RenewalController::class, 'destroy'])->middleware('tenant.permission:delete_record');

        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::post('/inventory', [InventoryController::class, 'store'])->middleware('tenant.permission:create_inventory');
        Route::put('/inventory/{id}', [InventoryController::class, 'update'])->middleware('tenant.permission:edit_existing');
        Route::delete('/inventory/{id}', [InventoryController::class, 'destroy'])->middleware('tenant.permission:delete_record');
        Route::post('/inventory/{id}/adjust-stock', [InventoryController::class, 'adjustStock'])->middleware('tenant.permission:adjust_stock');

        Route::get('/tenant-users', [TenantUserController::class, 'index'])->middleware('tenant.permission:manage_users');
        Route::post('/tenant-users', [TenantUserController::class, 'store'])->middleware('tenant.permission:manage_users');
        Route::put('/tenant-users/{userId}', [TenantUserController::class, 'updateMembership'])->middleware('tenant.permission:manage_users');
        Route::delete('/tenant-users/{userId}', [TenantUserController::class, 'destroy'])->middleware('tenant.permission:manage_users');
        Route::post('/tenant-users/{userId}/reset-password', [TenantUserController::class, 'resetPassword'])->middleware('tenant.permission:manage_users');

        Route::get('/custom-fields', [CustomFieldController::class, 'index']);
        Route::post('/custom-fields', [CustomFieldController::class, 'store'])->middleware('tenant.permission:manage_custom_fields');
        Route::put('/custom-fields/{id}', [CustomFieldController::class, 'update'])->middleware('tenant.permission:manage_custom_fields');
        Route::delete('/custom-fields/{id}', [CustomFieldController::class, 'destroy'])->middleware('tenant.permission:manage_custom_fields');

        Route::get('/custom-field-values/{entityType}/{entityId}', [CustomFieldValueController::class, 'index']);
        Route::put('/custom-field-values/{entityType}/{entityId}', [CustomFieldValueController::class, 'upsert'])->middleware('tenant.permission:edit_existing');

        Route::get('/tenant-settings', [TenantSettingsController::class, 'show'])->middleware('tenant.permission:manage_users');
        Route::put('/tenant-settings', [TenantSettingsController::class, 'update'])->middleware('tenant.permission:manage_users');

        Route::get('/recycle-bin', [RecycleBinController::class, 'index'])->middleware('tenant.permission:view_audit_logs');
        Route::post('/recycle-bin/{entityType}/{id}/restore', [RecycleBinController::class, 'restore'])->middleware('tenant.permission:delete_record');
        Route::delete('/recycle-bin/{entityType}/{id}', [RecycleBinController::class, 'forceDelete'])->middleware('tenant.permission:delete_record');
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->middleware('tenant.permission:view_audit_logs');
        Route::get('/audit-logs/export', [AuditLogController::class, 'export'])->middleware('tenant.permission:view_audit_logs');

        Route::get('/stock-allocations', [StockAllocationController::class, 'index']);
        Route::post('/stock-allocations', [StockAllocationController::class, 'store'])->middleware('tenant.permission:allocate_stock');
        Route::post('/stock-allocations/{id}/cancel', [StockAllocationController::class, 'cancel'])->middleware('tenant.permission:allocate_stock');

        Route::middleware('tenant.permission:view_reports')->group(function () {
            Route::get('/reports/renewal-status', [ReportController::class, 'renewalStatusSummary']);
            Route::get('/reports/renewals-by-client', [ReportController::class, 'renewalsByClient']);
            Route::get('/reports/renewals-expiring', [ReportController::class, 'renewalsExpiring']);
            Route::get('/reports/inventory-summary', [ReportController::class, 'inventorySummary']);
            Route::get('/reports/stock-movements', [ReportController::class, 'stockMovements']);
            Route::get('/reports/stock-allocations', [ReportController::class, 'stockAllocations']);
            Route::get('/reports/client-portfolio', [ReportController::class, 'clientPortfolio']);
        });
    });
});
