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
- Renewal and inventory modules with soft deletes and recycle-bin restore.
- Custom field definitions and typed value storage.
- Daily purge command for records in recycle bin older than 30 days.

## Repository Layout

- `backend`: Laravel API, tenancy, RBAC, audit, business modules.
- `frontend`: Single React app with role-aware routing and dashboards.
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

## Interactive UI Coverage

The frontend now includes working actions (API-backed buttons/forms) for:

- Dashboard refresh with renewal and low-stock widgets
- Renewal create/list/delete
- Inventory create/list/check-in/check-out/delete
- Recycle bin list and restore
- Tenant admin: tenant users, edit permission toggles, custom fields, tenant audit logs
- Superadmin: tenant create/suspend/delete (tenant creation includes new tenant-admin creation), global audit logs, break-glass session controls

## Demo Credentials

- Superadmin: `superadmin@example.com` / `Superadmin123!`
- Tenant Admin: `tenantadmin@example.com` / `Tenantadmin123!`

## Test Commands

Backend:

- Unit tests: `cd backend && php artisan test --testsuite=Unit`
- Full tests: `cd backend && php artisan test`

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
