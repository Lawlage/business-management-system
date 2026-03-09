# Backend

Laravel API backend for the multi-tenant business management platform.

## Core capabilities

- Database-per-tenant architecture (`stancl/tenancy`)
- Tenant membership + role permissions
- Break-glass superadmin access with immutable audit events
- Renewal and inventory modules
- Custom fields with typed values
- Soft deletes + recycle-bin restore + scheduled purge after 30 days

## Commands

- `composer install`
- `php artisan migrate`
- `php artisan db:seed`
- `php artisan serve`
- `php artisan test --testsuite=Unit`
- `php artisan test`

See root `README.md` for full platform setup and workflow details.
