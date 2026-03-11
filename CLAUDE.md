# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Requirements Reference

`agents.md` is the source-of-truth for product requirements and delivery constraints. Consult it when making decisions about scope, behaviour, or architecture.

---

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

# Syntax check a PHP file
php -l path/to/file.php

# Scheduled command (runs daily in production)
php artisan app:purge-soft-deleted-records
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Vite dev server
npm run build        # tsc + Vite build (also type-checks)
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run test:e2e     # Playwright E2E

# TypeScript check only (faster than full build)
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
```

---

## Engineering Standards

### Testing — Non-Negotiable

**Always run the relevant test suite after making changes to confirm no regression.**

- Backend changes → `php artisan test` from `backend/`
- Frontend changes → `npm run test` and `npm run build` from `frontend/`
- New features must include new tests covering: happy path, permission boundaries, edge cases
- Test files follow the pattern in `tests/Feature/TenantSettingsTest.php` and use the `CreatesTenantContext` trait (`tests/CreatesTenantContext.php`)
- Backend tests use real MySQL — do NOT mock the database

### Security

Apply these at all times:

- **Input validation**: validate and sanitise all user input; escape LIKE metacharacters (`\`, `%`, `_`) in search queries
- **Authorisation**: always verify tenant membership before accessing/modifying tenant-scoped resources; never trust client-provided IDs alone
- **Least privilege**: default to the most restrictive permission; only expand when explicitly required
- **Timing safety**: use timing-safe comparisons for secrets (tokens, passwords)
- **Injection prevention**: use parameterised queries / Eloquent ORM; never concatenate raw user input into SQL
- **XSS prevention**: React's JSX escapes by default — avoid `dangerouslySetInnerHTML`
- **Token security**: store hashes of tokens, never plaintext; Sanctum tokens expire in 24 h
- **Rate limiting**: sensitive endpoints (login, password reset) must be rate-limited
- **Cross-tenant isolation**: every tenant-scoped query must be scoped to the active tenant — verify with `CrossTenantIsolationTest`

When in doubt, consult OWASP Top 10.

### Documentation Maintenance

After any meaningful change, update these files where applicable:

- **`CLAUDE.md`** — update Architecture, Commands, or Engineering Standards if the change affects how AI agents should work in this repo (new patterns, new directories, changed conventions, new config files)
- **`README.md`** (project root) — update if the change affects setup steps, environment requirements, available features, or anything a new developer needs to know to run the project

Do not update either file for routine bug fixes or minor tweaks that don't change how the project is understood or operated.

### Best Practices

- Follow the permission matrix in `app/Support/TenantPermissionMap.php` — do not hard-code role strings
- All tenant record mutations must emit an audit event via `AuditLogger::tenant()`; tenant lifecycle events use `AuditLogger::global()`
- Soft-delete all tenant-scoped models; never hard-delete without the recycle-bin flow
- API changes that affect existing contracts require a migration note
- Keep modules cohesive — new features belong in their own controller + service, not appended to existing ones
- Avoid over-engineering: implement only what is asked; do not add unrequested abstractions, fallbacks, or configuration options

---

## Architecture

### Repository Layout
- `backend/` — Laravel API (auth, tenancy, RBAC, business modules)
- `frontend/` — React SPA with role-aware routing
- `agents.md` — Product/delivery requirements
- `platform.sh` — Root control script; logs go to `logs/startup/<timestamp>/`

### Multi-Tenancy (stancl/tenancy)

Database-per-tenant isolation. Each tenant gets its own MySQL database provisioned automatically on creation (`CreateDatabase → MigrateDatabase` pipeline). Deletion triggers `DeleteDatabase`.

All tenant-scoped API requests require the `X-Tenant-Id` header. `InitializeTenantContext` middleware (`app/Http/Middleware/InitializeTenantContext.php`) reads this header, validates tenant status, calls `tenancy()->initialize($tenant)`, and restores central context in a `finally` block.

Tenant migrations live separately → `php artisan tenants:migrate`.

### API Routes & Middleware

All routes are in `backend/routes/api.php`. Three groups:

1. **Public** — `POST /api/auth/login`
2. **Superadmin** (`auth:sanctum` + `superadmin`) — tenant CRUD, break-glass, global audit logs
3. **Tenant-scoped** (`auth:sanctum` + `tenant.context`) — renewals, inventory, users, custom fields, settings, recycle bin, audit logs

Individual routes are further protected with `tenant.permission:<permission>` middleware.

### RBAC

Permission matrix: `app/Support/TenantPermissionMap.php`. Enforcement: `RequireTenantPermission` middleware. Roles defined in `app/Enums/TenantRole.php`:

| Role | Key permissions |
|---|---|
| `standard_user` | `edit_existing` |
| `sub_admin` | + `create_renewal`, `create_inventory` |
| `tenant_admin` | + `delete_record`, `manage_users`, `manage_custom_fields`, `view_audit_logs` |
| `global_superadmin` | Separate middleware (`RequireGlobalSuperadmin`); not a tenant role |

`can_edit` flag on `TenantMembership` can revoke `edit_existing` from standard users.

### Audit Logging

`app/Services/AuditLogger.php`:
- `global()` — writes to `GlobalAuditLog` (central DB) — tenant lifecycle, break-glass events
- `tenant()` — writes to `TenantAuditLog` (active tenant DB) — record-level events

Logs are immutable (insert-only). Tenant admins view tenant logs; superadmins view global logs.

### Break-Glass Access

Superadmins can access tenant data via a break-glass session (`POST /api/superadmin/tenants/{id}/break-glass`). Returns a token sent as `X-Break-Glass-Token`. `TenantAccessService` accepts this token in lieu of membership. The token is stored as SHA-256 hash. Every session is immutably logged.

### Frontend Structure

The frontend is a modular React SPA split across:

```
frontend/src/
  App.tsx                  # root router + layout
  main.tsx                 # React Query + BrowserRouter setup
  uiSettings.ts            # applyUiTheme() / normalizeUiSettings()
  index.css                # global styles / CSS custom properties
  types/                   # shared TypeScript types
  lib/                     # utilities
  hooks/                   # useApi() → authedFetch with X-Tenant-Id / X-Break-Glass-Token headers
  contexts/                # AuthContext, TenantContext, NoticeContext, ConfirmContext
  components/              # shared UI: Button, Input, Modal, Badge, Card, Sidebar, TopBar, etc.
  features/
    auth/                  # login page
    dashboard/
    renewals/              # RenewalsPage, RenewalDetailModal, CreateRenewalModal
    inventory/             # InventoryPage, InventoryDetailModal, CreateInventoryModal
    recycle-bin/
    admin/                 # tenant admin settings
    superadmin/            # global superadmin portal
```

- Routing: React Router v7 (`BrowserRouter` + `Routes`/`Route`)
- Data fetching: `@tanstack/react-query` v5 (`useQuery`/`useMutation`) in every feature page
- API calls: `useApi()` from `hooks/useApi.ts` — sets `X-Tenant-Id` and `X-Break-Glass-Token` automatically
- UI theming: CSS custom properties via `applyUiTheme()` in `uiSettings.ts`; settings include `theme_preset`, `density`, `font_family`, custom colour tokens
- All feature pages are lazy-loaded (`React.lazy`)
- Test wrapper requires `QueryClientProvider` + `BrowserRouter` around components

### Scheduled Tasks

`app:purge-soft-deleted-records` runs daily (`app/Console/Kernel.php`) — permanently deletes soft-deleted records older than 30 days.

### Key Models

Tenant-scoped (use `SoftDeletes`): `Renewal`, `InventoryItem`, `CustomFieldDefinition`, `CustomFieldValue`, `TenantAuditLog`

Central DB: `Tenant`, `User`, `TenantMembership`, `GlobalAuditLog`, `BreakGlassAccess`

### Key Config Files

- `backend/config/tenant_defaults.php` — default timezone and UI settings (single source of truth)
- `backend/config/sanctum.php` — token expiry (`SANCTUM_TOKEN_EXPIRATION` env, default 1440 min / 24 h)
