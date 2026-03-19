# Enterprise Multi-Tenant Business Management Platform

This repository contains a production-oriented foundation for a multi-tenant platform with:

- Laravel API backend (`backend`)
- React + Tailwind frontend (`frontend`)
- MySQL-based database-per-tenant model using `stancl/tenancy`

## AI Agent Requirements

For AI coding tools working in this repository, use `agents.md` as the source-of-truth requirements and delivery constraints document.

## Architecture Highlights

- Database-per-tenant provisioning through superadmin tenant creation.
- Strict tenant context middleware (`X-Tenant-Id`) and permission middleware.
- Role model: Global Superadmin, Tenant Admin, Sub Admin, Standard User.
- Break-glass access for superadmins with reason + confirmation + immutable logs.
- **Renewables two-layer model**: `RenewableProduct` catalog (template with optional default duration) + `Renewable` (client instance with schedule, computed `next_due_date`, and auto-calculated `status`).
- Inventory module with soft deletes and recycle-bin restore; cost/sale pricing fields.
- SLA Items product catalog with per-client SLA allocations.
- Departments for grouping renewables and allocations within a tenant.
- Document attachment support on renewables, renewable products, inventory items, clients, and SLA items (stored on private local disk; served via authenticated API).
- Custom field definitions and typed value storage — supports text, number, currency, date, boolean, JSON, and dropdown types.
- Daily purge command for records in recycle bin older than 30 days.
- Daily `app:refresh-renewable-due-dates` command recomputes `next_due_date` and `status` for all active renewables.

## Security Model

- **Authentication**: Laravel Sanctum Bearer tokens. Tokens expire after 24 hours (configurable via `SANCTUM_TOKEN_EXPIRATION`). The frontend clears auth state and redirects to login on 401 responses.
- **Login rate limiting**: 6 attempts per minute per IP (`throttle:6,1`). Timing-safe comparison prevents email enumeration.
- **Break-glass tokens**: Stored as SHA-256 hashes in the database. The plaintext token is returned to the caller once and never persisted.
- **Password policy**: Minimum 12 characters, requires uppercase, lowercase, digit, and special character. Enforced on all password fields.
- **Input sanitisation**: LIKE search terms are escaped for `%`, `_`, and `\` metacharacters. Recycle-bin entity type is validated against an allowlist.
- **Tenant defaults**: Centralised in `config/tenant_defaults.php` — single source of truth for initial timezone and UI settings.
- **Audit logging**: Tenant-scoped events write to the per-tenant `TenantAuditLog`; cross-tenant events (break-glass, tenant creation) write to the central `GlobalAuditLog`.

## Repository Layout

- `backend`: Laravel API, tenancy, RBAC, audit, business modules.
- `frontend`: Modular React app with role-aware routing, React Query data fetching, and feature-based directory structure (`features/`, `components/`, `contexts/`, `hooks/`).
- `tasks`: Local implementation notes (ignored by git).

## Backend Setup

1. Install dependencies:
   - `cd backend`
   - `composer install`
2. Configure environment:
   - `cp .env.example .env`
   - Set central MySQL connection (`DB_*`).
3. Run central migrations:
   - `php artisan migrate`
   - `php artisan tenants:migrate`
4. Seed demo data:
   - `php artisan db:seed`
5. Start API:
   - `php artisan serve`

### Tenant Database Provisioning Requirements

For automatic tenant DB creation, the DB user used by tenancy jobs must be allowed to create/drop databases that match the configured tenant naming convention (`tenant<uuid>` by default).

## Frontend Setup

1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Start app:
   - `npm run dev`

## Platform Script

Use the root platform control script to start/stop all services with logs:

- Start: `./platform.sh start`
- Stop: `./platform.sh stop`
- Restart: `./platform.sh restart`
- Status: `./platform.sh status`

Runtime logs are written to `logs/startup/<timestamp>/` and linked via `logs/startup/latest/`.

By default, `./platform.sh start` (and `restart`) runs backend bootstrapping before services start:

- `php artisan migrate --force`
- `php artisan tenants:migrate --force`
- `php artisan db:seed --force`

## Docker Setup

The platform can also run as a Docker Compose stack.

### Prerequisites

Docker Engine must be installed with the **Compose v2 plugin**. On Ubuntu, Docker's official apt repository is required — the Ubuntu-packaged Docker does not include the plugin:

```bash
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install docker-compose-plugin
```

Verify: `docker compose version`

### First-time setup

```bash
cp .env.docker .env
# Generate an app key and paste it into .env as APP_KEY:
cd backend && php artisan key:generate --show
cd ..
```

### Running

```bash
./platform.sh docker:up      # build images and start all services (detached)
./platform.sh docker:logs    # follow logs across all services
./platform.sh docker:down    # stop and remove containers
```

The stack binds to `127.0.0.1:8091`. A host Nginx vhost (see `tasks/dockerize.md`) terminates TLS and proxies to that port.

### Developing with Docker

| What changed | Action needed |
|---|---|
| Backend PHP code | Nothing — `./backend` is live-mounted; changes take effect immediately |
| Frontend code | Nothing — Vite HMR is active on port 5173 |
| New migration file | `docker compose exec backend php artisan migrate` |
| New tenant migration | `docker compose exec backend php artisan tenants:migrate` |
| `composer.json` / `composer.lock` | `./platform.sh docker:up` (triggers rebuild) |
| `package.json` / `package-lock.json` | `./platform.sh docker:up` (triggers rebuild) |
| `Dockerfile` or `docker/` config | `./platform.sh docker:up` (triggers rebuild) |

**Running tests inside Docker:**
```bash
docker compose exec backend php artisan test
docker compose exec backend php artisan test --filter=SomeTestClass
```

**Useful one-liners:**
```bash
docker compose exec backend php artisan tinker   # REPL
docker compose exec backend sh                   # shell into backend container
docker compose exec mysql mysql -u bms_user -p   # MySQL prompt
```

## Interactive UI Coverage

The frontend includes working actions (API-backed) for:

- Dashboard refresh with renewable and low-stock widgets
- **Renewable Products** create/list/edit with **Load More** pagination; name, category, vendor, cost price, optional default duration; document attachments; "Applied to clients" tab shows linked renewables
- **Renewables** create/list/edit with **Load More** pagination; linked to a renewable product and a client; per-client price and renewal schedule (days/months/years/day-of-month); computed next due date and urgency status badge; workflow status tracking; document attachments
- Inventory create/list/delete with **Load More** pagination and per-item quantity input for check-in/check-out; cost price, sale price, barcode, and document attachments on each item
- Click-to-open foreground edit modals for renewal/inventory records (Escape key dismisses); modals have **Details / Documents** tabs
- Stock allocation with client + department assignment
- **Client detail page** (full-page `/clients/:id`) with tabs: Details | Renewals | Allocations | Documents; Allocations tab has **By Item** (accordion) / **By Client** toggle
- **SLA Items** module: create/list/edit SLA product catalog items with SKU, tier, pricing, and document attachments; apply SLA items to clients via `ApplySlaModal`; cancel SLA allocations from item detail
- **Departments** admin page: simple list with add/delete (tenant admin only); department dropdown available on renewals and stock allocations
- **Dropdown custom field type**: create custom fields of type `dropdown` with a dynamic options editor; renders as a `<select>` when editing records
- Recycle bin list and restore (supports `sla_item` entity type)
- Tenant admin: tenant users, edit permission toggles, custom fields (all entity types shown), departments, tenant settings (timezone + appearance presets/colours/density/typography), tenant audit logs with **Load More** pagination
- Superadmin: tenant create/suspend/delete (tenant creation includes new tenant-admin creation), global audit logs, break-glass session controls
- Role is resolved from the active tenant membership (not the highest role across all tenants)

## Demo Credentials

- Superadmin: `superadmin@example.com` / `Superadmin123!`
- Tenant Admin: `tenantadmin@example.com` / `Tenantadmin123!`

## Test Commands

Backend:

- Unit tests: `cd backend && php artisan test --testsuite=Unit`
- Full tests: `cd backend && php artisan test`
- Tenant schema updates: `cd backend && php artisan tenants:migrate`

Frontend:

- Unit/component tests: `cd frontend && npm run test`
- Build: `cd frontend && npm run build`
- E2E tests: `cd frontend && npm run test:e2e`

Note: backend tests use your configured MySQL test/runtime connection from `.env` or `.env.testing`.

## Key Extension Points

- Auth roadmap: add MFA/SSO provider implementations in auth layer.
- Notifications: add email/scheduled digest jobs from dashboard alert queries.
- Integrations: emit domain events from renewals/inventory for outbound connectors.
- Security hardening: move break-glass to dual-approval and enforce re-auth for start.
