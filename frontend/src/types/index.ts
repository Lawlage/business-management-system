import type { TenantUiSettings } from '../uiSettings'

export type { TenantUiSettings }

export type AppRole = 'standard_user' | 'sub_admin' | 'tenant_admin' | 'global_superadmin'

export type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  data?: {
    timezone?: string
    ui_settings?: TenantUiSettings
  }
}

export type TenantMembership = {
  tenant_id: string
  role: AppRole
  can_edit: boolean
  tenant?: Tenant
}

export type AuthUser = {
  id: number
  first_name: string
  last_name: string
  email: string
  is_global_superadmin: boolean
  tenant_memberships: TenantMembership[]
}

export type Renewal = {
  id: number
  title: string
  status: string
  workflow_status?: string | null
  auto_renews?: boolean
  category: string
  expiration_date: string
  notes?: string | null
  created_at?: string
}

export type InventoryItem = {
  id: number
  name: string
  sku: string
  quantity_on_hand: number
  minimum_on_hand: number
  location?: string | null
  vendor?: string | null
  purchase_date?: string | null
  notes?: string | null
  created_at?: string
}

export type CustomField = {
  id: number
  entity_type: 'renewal' | 'inventory' | 'both'
  name: string
  key: string
  field_type: string
}

export type CustomFieldValueResponse = {
  definition_id: number
  value: string | number | boolean | null
}

export type TenantUserMembership = {
  id: number
  role: AppRole
  can_edit: boolean
  user: {
    id: number
    first_name: string
    last_name: string
    email: string
  }
}

export type AuditLog = {
  id: number
  event: string
  triggered_by_name: string | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export type PaginatedResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
}

export type DashboardData = {
  important_renewals: Renewal[]
  critical_renewals: Renewal[]
  low_stock_items: InventoryItem[]
}

export type RecycleBinData = {
  renewals: PaginatedResponse<Renewal>
  inventory_items: PaginatedResponse<InventoryItem>
  custom_fields: PaginatedResponse<CustomField>
}

export type TenantAuditData = {
  tenant_logs: PaginatedResponse<AuditLog>
  break_glass_logs: PaginatedResponse<AuditLog>
}

export const roleLabels: Record<AppRole, string> = {
  standard_user: 'Standard User',
  sub_admin: 'Sub Admin',
  tenant_admin: 'Tenant Admin',
  global_superadmin: 'Global Superadmin',
}

export const renewalCategoryOptions = [
  { value: 'contract', label: 'Contract' },
  { value: 'license', label: 'License' },
  { value: 'sla_renewal', label: 'SLA Renewal' },
  { value: 'domain', label: 'Domain' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'maintenance', label: 'Maintenance Agreement' },
  { value: 'other', label: 'Other' },
]

export const renewalWorkflowOptions = [
  'Active - paid and in force',
  'Client contacted',
  'Discovery in progress',
  'Drafting quote',
  'Quote sent',
  'Negotiation',
  'Legal review',
  'Awaiting signature',
  'Approved for renewal',
  'Deferred',
  'Closed',
]

export const renewalDefaults = {
  title: '',
  category: 'contract',
  expiration_date: '',
  workflow_status: '',
  auto_renews: false,
  notes: '',
}

export const inventoryDefaults = {
  name: '',
  sku: '',
  quantity_on_hand: 0,
  minimum_on_hand: 0,
  location: '',
  vendor: '',
  notes: '',
}
