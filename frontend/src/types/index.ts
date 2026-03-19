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
  last_login_at: string | null
  tenant_memberships: TenantMembership[]
}

export type Client = {
  id: number
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  notes?: string | null
  created_at?: string
}

export type Department = {
  id: number
  name: string
  manager_id?: number | null
  manager?: { id: number; first_name: string; last_name: string } | null
  created_at?: string
}

export type FrequencyType = 'days' | 'months' | 'years' | 'day_of_month'

export type FrequencyValue = {
  type: FrequencyType
  value: number
  startDate?: string // ISO date; only for days/months/years
}

export type RenewableProduct = {
  id: number
  name: string
  category?: string | null
  vendor?: string | null
  cost_price: string
  frequency_type?: 'days' | 'months' | 'years' | null
  frequency_value?: number | null
  notes?: string | null
  renewables_count?: number
  created_at?: string
}

export type Renewable = {
  id: number
  renewable_product_id: number
  renewable_product?: RenewableProduct | null
  description?: string | null
  client_id: number
  client?: { id: number; name: string } | null
  department_id?: number | null
  department?: { id: number; name: string } | null
  workflow_status?: string | null
  sale_price?: string | null
  frequency_type?: FrequencyType | null
  frequency_value?: number | null
  frequency_start_date?: string | null
  next_due_date?: string | null
  status?: string | null
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
  cost_price?: string | null
  sale_price?: string | null
  barcode?: string | null
  created_at?: string
}

export type SlaItem = {
  id: number
  name: string
  sku: string
  tier?: string | null
  response_time?: string | null
  resolution_time?: string | null
  cost_price: string
  sale_price: string
  notes?: string | null
  sla_group_id?: number | null
  sla_group?: { id: number; name: string } | null
  created_at?: string
}

export type SlaGroup = {
  id: number
  name: string
  sla_items?: SlaItem[]
  created_at?: string
}

export type SlaAllocation = {
  id: number
  sla_item_id: number
  client_id: number
  department_id?: number | null
  quantity: number
  unit_price: string | null
  notes: string | null
  renewal_date: string | null
  status: 'active' | 'cancelled'
  allocated_by: number
  cancelled_by: number | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  sla_item?: { id: number; name: string; sku: string; sla_group?: { id: number; name: string } | null }
  client?: { id: number; name: string }
  department?: { id: number; name: string } | null
}

export type Attachment = {
  id: number
  attachment_id: number
  original_name: string
  mime_type: string | null
  size: number
  uploaded_by: number
  created_at: string
}

export type CustomField = {
  id: number
  entity_type: string[]
  name: string
  key: string
  field_type: string
  dropdown_options?: string[] | null
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
    last_login_at: string | null
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

export type StockAllocation = {
  id: number
  inventory_item_id: number
  client_id: number
  department_id?: number | null
  quantity: number
  unit_price: string | null
  notes: string | null
  status: 'allocated' | 'cancelled'
  allocated_by: number
  cancelled_by: number | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  inventory_item?: { id: number; name: string; sku: string }
  client?: { id: number; name: string }
  department?: { id: number; name: string } | null
}

export type PaginatedResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
}

export type DashboardData = {
  upcoming_renewals: Renewable[]
  critical_renewals: Renewable[]
  low_stock_items: InventoryItem[]
  upcoming_sla_allocations: SlaAllocation[]
}

export type RecycleBinData = {
  renewables: PaginatedResponse<Renewable>
  renewable_products: PaginatedResponse<RenewableProduct>
  inventory_items: PaginatedResponse<InventoryItem>
  custom_fields: PaginatedResponse<CustomField>
  clients: PaginatedResponse<Client>
  sla_items: PaginatedResponse<SlaItem>
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

export const renewableCategoryOptions = [
  { value: 'contract', label: 'Contract' },
  { value: 'license', label: 'License' },
  { value: 'domain', label: 'Domain' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'maintenance', label: 'Maintenance Agreement' },
  { value: 'other', label: 'Other' },
]

export const renewableWorkflowOptions = [
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

export const renewableProductDefaults = {
  name: '',
  category: 'contract',
  vendor: '',
  cost_price: '0.00',
  notes: '',
}

export const renewableDefaults = {
  renewable_product_id: null as number | null,
  description: '',
  client_id: null as number | null,
  department_id: null as number | null,
  workflow_status: '',
  sale_price: '0.00',
  notes: '',
}

export const clientDefaults = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
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
  cost_price: '0.00',
  sale_price: '0.00',
  barcode: '',
}

export const slaItemDefaults = {
  name: '',
  sku: '',
  tier: '',
  cost_price: '0.00',
  sale_price: '0.00',
  notes: '',
  sla_group_id: null as number | null,
}
