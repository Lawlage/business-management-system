# AI Coding Agent Requirements

This file defines the required implementation and quality rules for any AI coding tool working in this repository.

## 1) Product Objective

Build and maintain a production-grade, enterprise-grade multi-tenant business management platform with:

- Strong tenant isolation
- Enterprise security boundaries
- Maintainable modular architecture
- Extensibility for MFA, SSO, and integrations

## 2) Required Tech Stack

- Backend: Laravel
- Frontend: React
- UI: Tailwind CSS
- Database: MySQL

## 3) Core Modules

1. Renewal object management
2. Inventory management
3. Client management (full-page detail, allocation history, document attachments)
4. SLA Items (product catalog + per-client SLA allocations)
5. Departments (tenant-scoped grouping for renewals and allocations)
6. Attachment management (documents on renewals, inventory, clients, SLA items)

## 4) Non-Negotiable Platform Capabilities

- Multi-tenancy
- RBAC (role-based access control)
- Immutable audit logging
- Soft deletes with 30-day recycle bin
- Attachment support
- Custom tenant-defined fields
- Thorough automated testing
- Extensible architecture

## 5) Multi-Tenancy Requirements

Preferred model: separate database per tenant, automatically provisioned.

Required behaviors:

- Tenant DB creation automated from the application
- Global superadmin can create tenants from frontend
- Provisioning configures DB, migrations, and initial data
- Strict tenant isolation and no cross-tenant data access
- Tenant-safe query architecture must be enforced

If separate DB per tenant cannot be operated safely, a shared-DB fallback may be used only with strict tenant scoping and explicit justification.

## 6) Interfaces in One React App

Single React app with role-aware routing and dashboards.

### 6.1 Primary User Interface

- Standard user login experience
- Dashboard widgets:
  - Most Important Renewals (default threshold within 1 month)
  - Critical renewals alert (<= 1 week)
  - Low-stock inventory alerts
- Dashboard customizable with filters/widgets
- Standard user permissions:
  - Can edit existing objects
  - Cannot create new objects
  - Cannot delete objects
  - Cannot create inventory entries
- Tenant admins can revoke user edit permissions

### 6.2 Tenant Admin Interface

- Same primary interface plus burger-menu option: Admin Settings
- Admin Settings must support:
  - Create/delete tenant users
  - Reset passwords
  - Manage permissions
  - Create sub-admin users
  - Create renewal objects
  - Create inventory items
  - Ingest/classify stock items
  - Delete tenant-scoped entries
  - Manage custom fields
  - View tenant audit logs
  - View break-glass logs affecting their tenant
- Tenant admin must NOT:
  - Create/delete tenants
  - Assign tenant admin roles unless globally controlled
  - Assign global superadmin roles

### 6.3 Global Superadmin Portal

- Dedicated portal post-login
- Must support:
  - Create/delete/suspend/manage tenants
  - Assign tenant admins
  - View global audit logs
  - Break-glass access into any tenant

Break-glass requirements:

- Mandatory reason input
- Mandatory confirmation checkbox for permission received
- Immutable logging of access and reason
- Tenant admins can view break-glass logs for their tenant

## 7) RBAC Model Requirements

Global role:

- Global Superadmin

Tenant roles:

- Tenant Admin
- Sub Admin
- Standard User

Permission expectations:

- Standard User: edit existing records only
- Sub Admin: create renewals, ingest inventory, operational data entry
- Tenant Admin: manage users, create/delete tenant data, assign sub-admins, revoke edit rights, manage custom fields
- Global Superadmin: create/delete tenants, assign tenant admins, break-glass access, global oversight

Implementation must include a maintainable permission matrix and enforcement in API + UI.

## 8) Module Requirements

### 8.1 Renewal Object Management

Tracks contracts/licenses/domains and other renewable objects.

Required fields:

- title
- type/category
- owner
- vendor/provider
- start date
- renewal date
- expiration date
- status
- cost_price, sale_price
- department (optional, linked to tenant Departments list)
- notes
- attachments
- tenant
- created_by
- updated_by
- custom fields (including dropdown type)

Statuses (standardized):

- No action needed
- Upcoming
- Action required
- Urgent
- Expired

Status auto-calculation thresholds:

- Upcoming: <= 2 months
- Action Required: <= 1 month
- Urgent: <= 1 week
- Expired: expiration date passed

Constraints:

- Workflow remains manual
- Do not auto-create future renewal objects

Dashboard/reporting:

- urgency sorting, filtering, search, reporting
- in-app critical alerts for renewals <= 1 week
- architecture must support future email reminders, scheduled reports, and digests

### 8.2 Inventory Management

Must support:

- inventory records
- stock quantities
- minimum on-hand threshold
- low-stock alerts
- check-out workflows
- classification and ingest

Required fields:

- item name
- SKU/asset ID
- category/classification
- quantity on hand
- minimum on hand
- location
- supplier/vendor
- purchase date
- optional renewal/warranty linkage
- cost_price, sale_price
- barcode (optional)
- notes
- attachments
- tenant
- custom fields (including dropdown type)

Rules:

- Only tenant admins and sub-admins can create stock items
- Users can update existing items if permitted
- Users can check items in/out
- Dashboard must show low-stock alerts
- Reporting should prioritize resupply needs

## 9) Custom Fields Requirements

Tenants can define custom fields for:

- renewal objects
- inventory items
- both (applies to either entity type)

Must support:

- multiple data types: text, number, currency, date, boolean, JSON, dropdown
- dropdown fields require a non-empty options list (`dropdown_options: string[]` stored as JSON)
- validation rules
- filtering and searching
- per-tenant configuration

Design mandate:

- maintainable architecture
- avoid fragile JSON-only hacks

## 9a) SLA Items Module

Product-catalog-style SLA definitions that can be applied to clients.

Required fields:

- name
- SKU (unique per tenant)
- tier (optional, e.g. Gold / Platinum)
- response_time, resolution_time (optional strings)
- cost_price, sale_price
- notes
- attachments
- soft-delete with recycle-bin support

SLA Allocations (applying an SLA item to a client):

- sla_item_id, client_id, department_id (optional)
- quantity, unit_price (optional)
- status: active | cancelled
- cancellation tracked (cancelled_by, cancelled_at)

## 9b) Departments

Simple name-only list per tenant. Departments can be assigned to:

- renewals (department_id on Renewal)
- stock allocations (department_id on StockAllocation)
- SLA allocations (department_id on SlaAllocation)

Only tenant admins can create/delete departments.

## 10) Reference Data Model

Hybrid approach required:

- Tenant-scoped by default: vendors, categories, tags, classifications
- Optional platform templates tenants can copy from
- No shared operational data across tenants

## 11) Delete / Recycle Bin Requirements

- Soft deletes
- 30-day recycle bin
- Restore functionality
- Permanent purge after retention period
- Deletion and restoration must be audited

## 12) Audit Logging Requirements

Audit logs must be immutable and include:

- tenant creation/deletion
- user creation/deletion
- password resets
- role changes
- break-glass access and reason
- break-glass confirmation checkbox state
- record create/edit/delete
- recycle-bin restore
- custom field changes

Visibility:

- Tenant admins can view logs affecting their tenant

## 13) Authentication Requirements

Current:

- Email/password

Future-ready design:

- MFA
- SSO
- tenant-admin self-service SSO configuration

Must be extensible without major refactor.

## 14) UX / UI Requirements

- Clean enterprise admin UX
- Strong filtering and table controls
- Customizable dashboards
- Urgency-based visual hierarchy
- Clear alert system
- Reusable components
- Role-aware navigation
- Tenant admin tools in admin menu
- Dedicated global admin portal

## 15) Database Requirements

MySQL schema must support:

- tenancy model
- custom fields
- RBAC relationships
- audit logs
- soft deletes
- attachments
- future auth expansion

## 16) Testing Requirements

Backend tests required:

- unit
- feature
- API
- RBAC
- tenant isolation
- cross-tenant access prevention

Frontend tests required:

- component
- integration

E2E scenarios required:

- tenant creation/deletion
- tenant admin assignment
- break-glass access
- user create/delete
- password reset
- renewal alerts
- inventory creation
- stock updates
- low-stock alerts
- check-out workflows
- custom field usage
- recycle-bin restore
- unauthorized action prevention

All changes should include test updates and runnable test instructions.

## 17) Delivery Process Requirements

### Phase 1: Architecture and Discovery

Produce:

1. Technical specification
2. Recommended tenancy model
3. RBAC permission matrix
4. Domain model
5. Database schema proposal
6. Frontend architecture
7. Custom field architecture
8. Audit logging design
9. Break-glass workflow design
10. Testing strategy
11. Risks and assumptions

### Phase 2: Implementation Plan

Produce:

- phased roadmap
- recommended libraries/packages with rationale
- infrastructure assumptions
- deployment considerations

### Phase 3: Implementation

Deliver:

- backend
- frontend
- tests
- documentation

### Phase 4: Handoff

Provide:

- setup instructions
- environment configuration
- seed/demo credentials
- test commands
- deployment guidance
- architecture decision summary
- extension points for future features

## 18) Engineering Standards for AI Agents

- Follow enterprise architecture and strict tenant isolation at all times.
- Preserve maintainable modular design over quick hacks.
- Prefer secure defaults and least privilege.
- Keep logs and audit events complete and immutable.
- Update tests and documentation with every meaningful feature change.
- Avoid introducing breaking schema/API changes without migration notes.
