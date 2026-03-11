# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Requirements Reference

`agents.md` is the source-of-truth for product requirements and delivery constraints. Consult it when making decisions about scope, behaviour, or architecture.

## Commands

### Platform (start everything)
```
./platform.sh start     # bootstrap + start backend + frontend
./platform.sh stop
./platform.sh restart
./platform.sh status
```

### Backend
```bash
cd backend
composer install
php artisan migrate
php artisan tenants:migrate      # run migrations across all tenant DBs
php artisan db:seed
php artisan serve

# Tests
php artisan test                            # full suite
php artisan test --testsuite=Unit           # unit only
php artisan test --filter=SomeTestClass     # single test class

# Scheduled command (runs daily in production)
php artisan app:purge-soft-deleted-records
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Vite dev server
npm run build        # tsc + Vite build
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run test:e2e     # Playwright E2E
```

## Architecture

### Repository Layout
- `backend/` — Laravel API (auth, tenancy, RBAC, business modules)
- `frontend/` — Single React SPA with role-aware routing
- `agents.md` — Product/delivery requirements for AI agents
- `platform.sh` — Root control script; logs go to `logs/startup/<timestamp>/`

### Multi-Tenancy (stancl/tenancy)

The platform uses **database-per-tenant** isolation via `stancl/tenancy`. Each tenant gets its own MySQL database provisioned automatically when a tenant is created (via a `JobPipeline`: `CreateDatabase → MigrateDatabase`). Deletion triggers `DeleteDatabase`.

All tenant-scoped API requests require the `X-Tenant-Id` header. The `InitializeTenantContext` middleware (`app/Http/Middleware/InitializeTenantContext.php`) reads this header, validates tenant status, checks access, calls `tenancy()->initialize($tenant)`, and restores central context after the request in a `finally` block.

Tenant migrations live separately and are applied with `php artisan tenants:migrate`.

### API Routes & Middleware

All routes are in `backend/routes/api.php`. Three route groups:

1. **Public** — `POST /api/auth/login`
2. **Superadmin** (`auth:sanctum` + `superadmin` middleware) — tenant CRUD, break-glass, global audit logs
3. **Tenant-scoped** (`auth:sanctum` + `tenant.context` middleware) — renewals, inventory, users, custom fields, settings, recycle bin, audit logs

Individual routes are further protected with `tenant.permission:<permission>` middleware.

### RBAC

Permission matrix is defined in `app/Support/TenantPermissionMap.php` and enforced by `RequireTenantPermission` middleware. Roles (defined in `app/Enums/TenantRole.php`):

| Role | Key permissions |
|---|---|
| `standard_user` | `edit_existing` |
| `sub_admin` | + `create_renewal`, `create_inventory` |
| `tenant_admin` | + `delete_record`, `manage_users`, `manage_custom_fields`, `view_audit_logs` |
| `global_superadmin` | Separate middleware (`RequireGlobalSuperadmin`); not a tenant role |

`can_edit` flag on `TenantMembership` can revoke `edit_existing` from standard users.

### Audit Logging

`app/Services/AuditLogger.php` provides two methods:
- `global()` — writes to `GlobalAuditLog` (central DB), used for tenant lifecycle and break-glass events
- `tenant()` — writes to `TenantAuditLog` (active tenant DB), used for record-level events

Logs are immutable (insert-only). Tenant admins can view their tenant's logs; superadmins see global logs.

### Break-Glass Access

Superadmins can access tenant data by starting a break-glass session (`POST /api/superadmin/tenants/{id}/break-glass`). This returns a token sent as `X-Break-Glass-Token` on subsequent tenant-scoped requests. `TenantAccessService` accepts this token in lieu of a normal membership. Every session is immutably logged with reason and confirmation state.

### Frontend Structure

The frontend is a **single-file React app**: all pages, forms, state, and logic live in `frontend/src/App.tsx`. There is no separate components directory. Routing is handled by React Router v7 (`BrowserRouter` + `Routes`/`Route`).

State management uses React's `useState`/`useEffect` — `@tanstack/react-query` is configured in `main.tsx` but data fetching in `App.tsx` is done with plain `fetch`.

UI theming is driven by CSS custom properties applied by `applyUiTheme()` in `frontend/src/uiSettings.ts`. Settings include `theme_preset`, `density`, `font_family`, and custom colour tokens. The tenant's `data.ui_settings` object is normalised through `normalizeUiSettings()` before use.

API calls from the frontend set the `X-Tenant-Id` header on every tenant-scoped request and `X-Break-Glass-Token` when in a break-glass session.

### Scheduled Tasks

`app:purge-soft-deleted-records` runs daily (configured in `app/Console/Kernel.php`) and permanently deletes soft-deleted records older than 30 days.

### Key Models

All tenant-scoped models (`Renewal`, `InventoryItem`, `CustomFieldDefinition`, `CustomFieldValue`, `TenantAuditLog`, etc.) use `SoftDeletes`. Central models (`Tenant`, `User`, `TenantMembership`, `GlobalAuditLog`, `BreakGlassAccess`) live in the central database.
