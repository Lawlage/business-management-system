import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

type AppRole = 'standard_user' | 'sub_admin' | 'tenant_admin' | 'global_superadmin'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  data?: {
    timezone?: string
  }
}

type TenantMembership = {
  tenant_id: string
  role: AppRole
  can_edit: boolean
  tenant?: Tenant
}

type AuthUser = {
  id: number
  email: string
  is_global_superadmin: boolean
  tenant_memberships: TenantMembership[]
}

type Renewal = {
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

type InventoryItem = {
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

type CustomField = {
  id: number
  entity_type: 'renewal' | 'inventory'
  name: string
  key: string
  field_type: string
}

type TenantUserMembership = {
  id: number
  role: AppRole
  can_edit: boolean
  user: {
    id: number
    name: string
    email: string
  }
}

const roleLabels: Record<AppRole, string> = {
  standard_user: 'Standard User',
  sub_admin: 'Sub Admin',
  tenant_admin: 'Tenant Admin',
  global_superadmin: 'Global Superadmin',
}

const renewalDefaults = {
  title: '',
  category: 'contract',
  expiration_date: '',
  workflow_status: '',
  auto_renews: false,
  notes: '',
}

const renewalCategoryOptions = [
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

const renewalWorkflowOptions = [
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

const tenantTimezoneOptions = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Australia/Sydney']

function formatDateTime(value?: string | null, timezone = 'UTC'): string {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date)
}

function formatRenewalCategory(value?: string | null): string {
  if (!value) {
    return 'Uncategorized'
  }

  const option = renewalCategoryOptions.find((entry) => entry.value === value)
  if (option) {
    return option.label
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const inventoryDefaults = {
  name: '',
  sku: '',
  quantity_on_hand: 0,
  minimum_on_hand: 0,
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme_preference') === 'light' ? 'light' : 'dark'))
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [isSuperadminTenantWorkspace, setIsSuperadminTenantWorkspace] = useState(false)
  const [breakGlassToken, setBreakGlassToken] = useState('')
  const [breakGlassReason, setBreakGlassReason] = useState('')
  const [breakGlassConfirmed, setBreakGlassConfirmed] = useState(false)
  const [tenantTimezone, setTenantTimezone] = useState('UTC')
  const [notice, setNotice] = useState('')

  const [dashboard, setDashboard] = useState<{ important_renewals: Renewal[]; critical_renewals: Renewal[]; low_stock_items: InventoryItem[] } | null>(null)
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [recycleBin, setRecycleBin] = useState<{ renewals: Renewal[]; inventory_items: InventoryItem[] } | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUserMembership[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [tenantAudit, setTenantAudit] = useState<{ tenant_logs: Array<{ id: number; event: string; created_at: string }>; break_glass_logs: Array<{ id: number; event: string; created_at: string }> } | null>(null)

  const [superTenants, setSuperTenants] = useState<Tenant[]>([])
  const [globalAudit, setGlobalAudit] = useState<Array<{ id: number; event: string; created_at: string }>>([])

  const [newRenewal, setNewRenewal] = useState(renewalDefaults)
  const [newInventory, setNewInventory] = useState(inventoryDefaults)
  const [newTenantUser, setNewTenantUser] = useState({ name: '', email: '', password: '', role: 'standard_user' as AppRole })
  const [newCustomField, setNewCustomField] = useState({ entity_type: 'renewal' as 'renewal' | 'inventory', name: '', key: '', field_type: 'text' })
  const [newTenant, setNewTenant] = useState({ name: '', slug: '' })
  const [newTenantAdmin, setNewTenantAdmin] = useState({ name: '', email: '', password: '' })
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)

  const role = useMemo(() => {
    if (!user) {
      return 'standard_user' as AppRole
    }
    if (user.is_global_superadmin) {
      return 'global_superadmin' as AppRole
    }
    const roles = user.tenant_memberships.map((membership) => membership.role)
    if (roles.includes('tenant_admin')) {
      return 'tenant_admin'
    }
    if (roles.includes('sub_admin')) {
      return 'sub_admin'
    }
    return 'standard_user'
  }, [user])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme_preference', theme)
  }, [theme])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setIsAuthenticated(false)
      return
    }

    void loadAuthenticatedUser(token)
  }, [token])

  useEffect(() => {
    if (!isAuthenticated || !selectedTenantId) {
      return
    }

    if (role === 'global_superadmin' && (!isSuperadminTenantWorkspace || !breakGlassToken)) {
      return
    }

    void Promise.all([loadDashboard(), loadRenewals(), loadInventory()])
    if (role === 'tenant_admin' || role === 'global_superadmin') {
      void loadTenantSettings()
    }

    if (role === 'tenant_admin') {
      void Promise.all([loadTenantUsers(), loadCustomFields(), loadTenantAuditLogs()])
    }

    if (role === 'global_superadmin' && isSuperadminTenantWorkspace) {
      void Promise.all([loadTenantUsers(), loadCustomFields(), loadTenantAuditLogs()])
    }
  }, [isAuthenticated, selectedTenantId, breakGlassToken, role, isSuperadminTenantWorkspace])

  useEffect(() => {
    if (role !== 'global_superadmin' || !isAuthenticated) {
      return
    }
    void Promise.all([loadSuperTenants(), loadGlobalAuditLogs()])
  }, [role, isAuthenticated])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  const authedFetch = async <T,>(path: string, init?: RequestInit, tenantScoped = false): Promise<T> => {
    if (!token) {
      throw new Error('Not authenticated')
    }

    const headers = new Headers(init?.headers ?? {})
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)

    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json')
    }

    if (tenantScoped) {
      if (!selectedTenantId) {
        throw new Error('Select a tenant first')
      }
      headers.set('X-Tenant-Id', selectedTenantId)
      if (role === 'global_superadmin') {
        if (!breakGlassToken) {
          throw new Error('Start break-glass access for tenant actions')
        }
        headers.set('X-Break-Glass-Token', breakGlassToken)
      }
    }

    const response = await fetch(path, { ...init, headers })
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
      throw new Error(payload?.message ?? `Request failed with status ${response.status}`)
    }

    return payload as T
  }

  const loadAuthenticatedUser = async (sessionToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Session expired')
      }

      const payload = (await response.json()) as { user: AuthUser }
      setUser(payload.user)
      setIsAuthenticated(true)

      if (payload.user.is_global_superadmin) {
        if (!selectedTenantId) {
          const tenant = superTenants[0]
          if (tenant) {
            setSelectedTenantId(tenant.id)
          }
        }
      } else if (!selectedTenantId) {
        const membershipTenant = payload.user.tenant_memberships[0]?.tenant_id
        if (membershipTenant) {
          setSelectedTenantId(membershipTenant)
        }
      }
    } catch {
      localStorage.removeItem('auth_token')
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.message ?? 'Sign-in failed')
      }

      localStorage.setItem('auth_token', data.token)
      setToken(data.token)
      setPassword('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      if (token) {
        await authedFetch('/api/auth/logout', { method: 'POST' })
      }
    } catch {
      // Ignore logout transport failures and clear local session.
    }

    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    setSelectedTenantId('')
    setIsSuperadminTenantWorkspace(false)
    setBreakGlassToken('')
    setShowPassword(false)
  }

  const withNotice = async (action: () => Promise<void>, successMessage: string) => {
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Request failed')
    }
  }

  const loadDashboard = async () => {
    const data = await authedFetch<{ important_renewals: Renewal[]; critical_renewals: Renewal[]; low_stock_items: InventoryItem[] }>('/api/dashboard', undefined, true)
    setDashboard(data)
  }

  const loadRenewals = async () => {
    const data = await authedFetch<{ data: Renewal[] }>('/api/renewals', undefined, true)
    setRenewals(data.data ?? [])
  }

  const loadInventory = async () => {
    const data = await authedFetch<{ data: InventoryItem[] }>('/api/inventory', undefined, true)
    setInventory(data.data ?? [])
  }

  const loadRecycleBin = async () => {
    const data = await authedFetch<{ renewals: Renewal[]; inventory_items: InventoryItem[] }>('/api/recycle-bin', undefined, true)
    setRecycleBin(data)
  }

  const loadTenantUsers = async () => {
    const data = await authedFetch<TenantUserMembership[]>('/api/tenant-users', undefined, true)
    setTenantUsers(data)
  }

  const loadCustomFields = async () => {
    const data = await authedFetch<CustomField[]>('/api/custom-fields?entity_type=renewal', undefined, true)
    setCustomFields(data)
  }

  const loadTenantAuditLogs = async () => {
    const data = await authedFetch<{ tenant_logs: Array<{ id: number; event: string; created_at: string }>; break_glass_logs: Array<{ id: number; event: string; created_at: string }> }>('/api/audit-logs', undefined, true)
    setTenantAudit(data)
  }

  const loadTenantSettings = async () => {
    const data = await authedFetch<{ timezone: string }>('/api/tenant-settings', undefined, true)
    setTenantTimezone(data.timezone || 'UTC')
  }

  const updateTenantSettings = async () => {
    await withNotice(async () => {
      await authedFetch('/api/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify({ timezone: tenantTimezone }),
      }, true)
    }, 'Tenant settings updated.')
  }

  const loadSuperTenants = async () => {
    const data = await authedFetch<Tenant[]>('/api/superadmin/tenants')
    setSuperTenants(data)
    if (!selectedTenantId && data.length > 0) {
      setSelectedTenantId(data[0].id)
    }
  }

  const loadGlobalAuditLogs = async () => {
    const data = await authedFetch<Array<{ id: number; event: string; created_at: string }>>('/api/superadmin/audit-logs')
    setGlobalAudit(data)
  }

  const startBreakGlass = async () => {
    await withNotice(async () => {
      const data = await authedFetch<{ token: string }>('/api/superadmin/tenants/' + selectedTenantId + '/break-glass', {
        method: 'POST',
        body: JSON.stringify({ reason: breakGlassReason, permission_confirmed: breakGlassConfirmed }),
      })
      setBreakGlassToken(data.token)
    }, 'Break-glass session started.')
  }

  const stopBreakGlass = async () => {
    await withNotice(async () => {
      await authedFetch('/api/superadmin/tenants/' + selectedTenantId + '/break-glass/' + breakGlassToken + '/stop', { method: 'POST' })
      setBreakGlassToken('')
      setBreakGlassReason('')
      setBreakGlassConfirmed(false)
    }, 'Break-glass session ended.')
  }

  const createRenewal = async () => {
    await withNotice(async () => {
      await authedFetch('/api/renewals', { method: 'POST', body: JSON.stringify(newRenewal) }, true)
      setNewRenewal(renewalDefaults)
      await Promise.all([loadRenewals(), loadDashboard()])
    }, 'Renewal created.')
  }

  const deleteRenewal = async (id: number) => {
    await withNotice(async () => {
      await authedFetch('/api/renewals/' + id, { method: 'DELETE' }, true)
      await Promise.all([loadRenewals(), loadDashboard()])
    }, 'Renewal moved to recycle bin.')
  }

  const updateRenewal = async () => {
    if (!selectedRenewal) {
      return
    }

    await withNotice(async () => {
      await authedFetch('/api/renewals/' + selectedRenewal.id, {
        method: 'PUT',
        body: JSON.stringify({
          title: selectedRenewal.title,
          category: selectedRenewal.category,
          expiration_date: selectedRenewal.expiration_date,
          workflow_status: selectedRenewal.workflow_status,
          auto_renews: selectedRenewal.auto_renews ?? false,
          notes: selectedRenewal.notes,
        }),
      }, true)
      setSelectedRenewal(null)
      await Promise.all([loadRenewals(), loadDashboard()])
    }, 'Renewal updated.')
  }

  const createInventory = async () => {
    await withNotice(async () => {
      await authedFetch('/api/inventory', { method: 'POST', body: JSON.stringify(newInventory) }, true)
      setNewInventory(inventoryDefaults)
      await Promise.all([loadInventory(), loadDashboard()])
    }, 'Inventory item created.')
  }

  const deleteInventory = async (id: number) => {
    await withNotice(async () => {
      await authedFetch('/api/inventory/' + id, { method: 'DELETE' }, true)
      await Promise.all([loadInventory(), loadDashboard()])
    }, 'Inventory item moved to recycle bin.')
  }

  const updateInventoryItem = async () => {
    if (!selectedInventoryItem) {
      return
    }

    await withNotice(async () => {
      await authedFetch('/api/inventory/' + selectedInventoryItem.id, {
        method: 'PUT',
        body: JSON.stringify({
          name: selectedInventoryItem.name,
          quantity_on_hand: selectedInventoryItem.quantity_on_hand,
          minimum_on_hand: selectedInventoryItem.minimum_on_hand,
          location: selectedInventoryItem.location,
          vendor: selectedInventoryItem.vendor,
          notes: selectedInventoryItem.notes,
        }),
      }, true)
      setSelectedInventoryItem(null)
      await Promise.all([loadInventory(), loadDashboard()])
    }, 'Inventory item updated.')
  }

  const adjustStock = async (id: number, type: 'check_in' | 'check_out') => {
    await withNotice(async () => {
      await authedFetch('/api/inventory/' + id + '/adjust-stock', {
        method: 'POST',
        body: JSON.stringify({ type, quantity: 1, reason: type === 'check_out' ? 'Checked out' : 'Checked in' }),
      }, true)
      await Promise.all([loadInventory(), loadDashboard()])
    }, 'Stock updated.')
  }

  const restoreEntity = async (entityType: 'renewal' | 'inventory', id: number) => {
    await withNotice(async () => {
      await authedFetch('/api/recycle-bin/' + entityType + '/' + id + '/restore', { method: 'POST' }, true)
      await Promise.all([loadRecycleBin(), loadRenewals(), loadInventory()])
    }, 'Record restored.')
  }

  const createTenantUser = async () => {
    await withNotice(async () => {
      await authedFetch('/api/tenant-users', { method: 'POST', body: JSON.stringify(newTenantUser) }, true)
      setNewTenantUser({ name: '', email: '', password: '', role: 'standard_user' })
      await loadTenantUsers()
    }, 'Tenant user created.')
  }

  const removeTenantUser = async (id: number) => {
    await withNotice(async () => {
      await authedFetch('/api/tenant-users/' + id, { method: 'DELETE' }, true)
      await loadTenantUsers()
    }, 'Tenant user removed.')
  }

  const toggleTenantUserEdit = async (id: number, canEdit: boolean) => {
    await withNotice(async () => {
      await authedFetch('/api/tenant-users/' + id, { method: 'PUT', body: JSON.stringify({ can_edit: !canEdit }) }, true)
      await loadTenantUsers()
    }, 'User permissions updated.')
  }

  const createCustomField = async () => {
    await withNotice(async () => {
      await authedFetch('/api/custom-fields', {
        method: 'POST',
        body: JSON.stringify({ ...newCustomField, is_required: false, validation_rules: [] }),
      }, true)
      setNewCustomField({ entity_type: 'renewal', name: '', key: '', field_type: 'text' })
      await loadCustomFields()
    }, 'Custom field created.')
  }

  const deleteCustomField = async (id: number) => {
    await withNotice(async () => {
      await authedFetch('/api/custom-fields/' + id, { method: 'DELETE' }, true)
      await loadCustomFields()
    }, 'Custom field deleted.')
  }

  const createTenant = async () => {
    await withNotice(async () => {
      await authedFetch('/api/superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({
          ...newTenant,
          tenant_admin: newTenantAdmin,
        }),
      })
      setNewTenant({ name: '', slug: '' })
      setNewTenantAdmin({ name: '', email: '', password: '' })
      await loadSuperTenants()
    }, 'Tenant created with tenant admin.')
  }

  const suspendTenant = async (tenantId: string) => {
    await withNotice(async () => {
      await authedFetch('/api/superadmin/tenants/' + tenantId + '/suspend', { method: 'POST' })
      await loadSuperTenants()
    }, 'Tenant suspended.')
  }

  const unsuspendTenant = async (tenantId: string) => {
    await withNotice(async () => {
      await authedFetch('/api/superadmin/tenants/' + tenantId + '/unsuspend', { method: 'POST' })
      await loadSuperTenants()
    }, 'Tenant unsuspended.')
  }

  const deleteTenant = async (tenantId: string) => {
    await withNotice(async () => {
      await authedFetch('/api/superadmin/tenants/' + tenantId, { method: 'DELETE' })
      await loadSuperTenants()
    }, 'Tenant deleted.')
  }

  const baseButton = theme === 'dark' ? 'rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700' : 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-100'
  const surface = theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
  const textMuted = theme === 'dark' ? 'text-slate-300' : 'text-slate-600'

  const appLinks = role === 'global_superadmin'
    ? (isSuperadminTenantWorkspace
        ? [
            { to: '/app', label: 'Dashboard' },
            { to: '/app/renewals', label: 'Renewals' },
            { to: '/app/inventory', label: 'Inventory' },
            { to: '/app/recycle-bin', label: 'Recycle Bin' },
          ]
        : [])
    : [
        { to: '/app', label: 'Dashboard' },
        { to: '/app/renewals', label: 'Renewals' },
        { to: '/app/inventory', label: 'Inventory' },
        { to: '/app/recycle-bin', label: 'Recycle Bin' },
      ]

  const adminLinks = role === 'tenant_admin' || (role === 'global_superadmin' && isSuperadminTenantWorkspace)
    ? [
        { to: '/app/admin/users', label: 'User Management' },
        { to: '/app/admin/custom-fields', label: 'Custom Fields' },
        { to: '/app/admin/tenant-settings', label: 'Tenant Settings' },
        { to: '/app/admin/audit', label: 'Tenant Audit' },
      ]
    : []

  const canManageTenantAdminPages = role === 'tenant_admin' || (role === 'global_superadmin' && isSuperadminTenantWorkspace)

  const selectedTenant = useMemo(() => {
    if (!selectedTenantId) {
      return null
    }

    if (role === 'global_superadmin') {
      return superTenants.find((tenant) => tenant.id === selectedTenantId) ?? null
    }

    return user?.tenant_memberships.find((membership) => membership.tenant_id === selectedTenantId)?.tenant ?? null
  }, [selectedTenantId, role, superTenants, user])

  useEffect(() => {
    if (selectedTenant?.data?.timezone) {
      setTenantTimezone(selectedTenant.data.timezone)
    }
  }, [selectedTenant])

  const headerTitle = useMemo(() => {
    if (role === 'global_superadmin' && !isSuperadminTenantWorkspace) {
      return 'Global Superadmin Portal'
    }

    if (selectedTenant?.name) {
      return `${selectedTenant.name}${selectedTenant.slug ? ` (${selectedTenant.slug})` : ''}`
    }

    return selectedTenantId ? `Tenant ${selectedTenantId}` : 'Tenant Workspace'
  }, [role, isSuperadminTenantWorkspace, selectedTenant, selectedTenantId])

  if (isLoading) {
    return <div className={`flex min-h-screen items-center justify-center ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'}`}>Loading...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        <button type="button" onClick={toggleTheme} className={`fixed bottom-4 right-4 z-50 ${baseButton}`}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <form onSubmit={handleLogin} className={`w-full max-w-md rounded-xl border p-6 shadow-sm ${surface}`}>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Use your platform credentials to access the dashboard.</p>
          <label className="mt-4 block text-sm" htmlFor="login-email">Email</label>
          <input id="login-email" className={`mt-1 w-full rounded-md border px-3 py-2 ${surface}`} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" type="email" required />
          <label className="mt-4 block text-sm" htmlFor="login-password">Password</label>
          <div className="relative mt-1">
            <input
              id="login-password"
              className={`w-full rounded-md border px-3 py-2 pr-12 ${surface}`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          {authError ? <p className="mt-3 text-sm text-red-500">{authError}</p> : null}
          <button type="submit" disabled={isSubmitting} className={`mt-5 w-full ${baseButton}`}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <button type="button" onClick={toggleTheme} className={`fixed bottom-4 right-4 z-50 ${baseButton}`}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>

      <header className={`border-b ${surface}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-bold">{headerTitle}</h1>
            <p className={`text-sm ${textMuted}`}>{user?.email} - {roleLabels[role]}</p>
          </div>
          <div className="flex items-center gap-2">
            {role === 'global_superadmin' ? <Link to="/superadmin/access" className={baseButton}>Tenant Access</Link> : null}
            <button onClick={handleLogout} className={baseButton}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 md:grid-cols-[240px_1fr]">
        <aside className={`rounded-xl border p-4 ${surface}`}>
          <p className={`mb-2 text-xs uppercase ${textMuted}`}>Main</p>
          <nav className="flex flex-col gap-2">
            {appLinks.map((link) => (<Link key={link.to} className={baseButton} to={link.to}>{link.label}</Link>))}
          </nav>

          {adminLinks.length > 0 ? (
            <>
              <p className={`mb-2 mt-4 text-xs uppercase ${textMuted}`}>Admin Settings</p>
              <nav className="flex flex-col gap-2">
                {adminLinks.map((link) => (<Link key={link.to} className={baseButton} to={link.to}>{link.label}</Link>))}
              </nav>
            </>
          ) : null}

          {role === 'global_superadmin' ? (
            <>
              <p className={`mb-2 mt-4 text-xs uppercase ${textMuted}`}>Superadmin</p>
              <nav className="flex flex-col gap-2">
                <Link className={baseButton} to="/superadmin">Tenant Management</Link>
                <Link className={baseButton} to="/superadmin/audit">Global Audit</Link>
                <Link className={baseButton} to="/superadmin/access">Tenant Access</Link>
              </nav>
            </>
          ) : null}
        </aside>

        <main className="space-y-4">
          {notice ? <div className={`rounded-md border p-3 text-sm ${surface}`}>{notice}</div> : null}

          <Routes>
            <Route path="/" element={<Navigate to={role === 'global_superadmin' ? '/superadmin' : '/app'} replace />} />
            <Route path="/app" element={role === 'global_superadmin' && !isSuperadminTenantWorkspace ? <Navigate to="/superadmin/access" replace /> : <DashboardPage surface={surface} textMuted={textMuted} dashboard={dashboard} reload={loadDashboard} />} />
            <Route path="/app/renewals" element={role === 'global_superadmin' && !isSuperadminTenantWorkspace ? <Navigate to="/superadmin/access" replace /> : <RenewalsPage surface={surface} textMuted={textMuted} timezone={tenantTimezone} renewals={renewals} form={newRenewal} setForm={setNewRenewal} onCreate={createRenewal} onDelete={deleteRenewal} onSelect={setSelectedRenewal} canCreate={role !== 'standard_user'} canDelete={role === 'tenant_admin' || role === 'global_superadmin'} />} />
            <Route path="/app/inventory" element={role === 'global_superadmin' && !isSuperadminTenantWorkspace ? <Navigate to="/superadmin/access" replace /> : <InventoryPage surface={surface} textMuted={textMuted} timezone={tenantTimezone} items={inventory} form={newInventory} setForm={setNewInventory} onCreate={createInventory} onDelete={deleteInventory} onAdjust={adjustStock} onSelect={setSelectedInventoryItem} canCreate={role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'} canDelete={role === 'tenant_admin' || role === 'global_superadmin'} />} />
            <Route path="/app/recycle-bin" element={role === 'global_superadmin' && !isSuperadminTenantWorkspace ? <Navigate to="/superadmin/access" replace /> : <RecycleBinPage surface={surface} textMuted={textMuted} data={recycleBin} reload={loadRecycleBin} onRestore={restoreEntity} />} />

            <Route path="/app/admin/users" element={canManageTenantAdminPages ? <TenantUsersPage surface={surface} users={tenantUsers} form={newTenantUser} setForm={setNewTenantUser} onCreate={createTenantUser} onRemove={removeTenantUser} onToggleEdit={toggleTenantUserEdit} reload={loadTenantUsers} /> : <Navigate to="/app" replace />} />
            <Route path="/app/admin/custom-fields" element={canManageTenantAdminPages ? <CustomFieldsPage surface={surface} fields={customFields} form={newCustomField} setForm={setNewCustomField} onCreate={createCustomField} onDelete={deleteCustomField} reload={loadCustomFields} /> : <Navigate to="/app" replace />} />
            <Route path="/app/admin/tenant-settings" element={canManageTenantAdminPages ? <TenantSettingsPage surface={surface} textMuted={textMuted} timezone={tenantTimezone} setTimezone={setTenantTimezone} save={updateTenantSettings} /> : <Navigate to="/app" replace />} />
            <Route path="/app/admin/audit" element={canManageTenantAdminPages ? <TenantAuditPage surface={surface} timezone={tenantTimezone} data={tenantAudit} reload={loadTenantAuditLogs} /> : <Navigate to="/app" replace />} />

            <Route path="/superadmin" element={role === 'global_superadmin' ? <SuperadminTenantsPage surface={surface} tenants={superTenants} tenantForm={newTenant} setTenantForm={setNewTenant} tenantAdminForm={newTenantAdmin} setTenantAdminForm={setNewTenantAdmin} onCreate={createTenant} onSuspend={suspendTenant} onUnsuspend={unsuspendTenant} onDelete={deleteTenant} reload={loadSuperTenants} /> : <Navigate to="/app" replace />} />
            <Route path="/superadmin/audit" element={role === 'global_superadmin' ? <GlobalAuditPage surface={surface} logs={globalAudit} reload={loadGlobalAuditLogs} /> : <Navigate to="/app" replace />} />
            <Route path="/superadmin/access" element={role === 'global_superadmin' ? <SuperadminTenantAccessPage surface={surface} textMuted={textMuted} tenants={superTenants} selectedTenantId={selectedTenantId} setSelectedTenantId={(tenantId) => { setSelectedTenantId(tenantId); setIsSuperadminTenantWorkspace(false); setBreakGlassToken('') }} breakGlassReason={breakGlassReason} setBreakGlassReason={setBreakGlassReason} breakGlassConfirmed={breakGlassConfirmed} setBreakGlassConfirmed={setBreakGlassConfirmed} breakGlassToken={breakGlassToken} startBreakGlass={startBreakGlass} stopBreakGlass={stopBreakGlass} enterWorkspace={() => { if (!selectedTenantId) { setNotice('Select a tenant before entering workspace.'); return; } if (!breakGlassToken) { setNotice('Start break-glass access before entering tenant workspace.'); return; } setIsSuperadminTenantWorkspace(true); }} /> : <Navigate to="/app" replace />} />
          </Routes>

          {selectedRenewal ? <RenewalModal surface={surface} textMuted={textMuted} renewal={selectedRenewal} setRenewal={setSelectedRenewal} onSave={updateRenewal} onClose={() => setSelectedRenewal(null)} /> : null}
          {selectedInventoryItem ? <InventoryModal surface={surface} textMuted={textMuted} item={selectedInventoryItem} setItem={setSelectedInventoryItem} onSave={updateInventoryItem} onClose={() => setSelectedInventoryItem(null)} /> : null}
        </main>
      </div>
    </div>
  )
}

function DashboardPage({ surface, textMuted, dashboard, reload }: { surface: string; textMuted: string; dashboard: { important_renewals: Renewal[]; critical_renewals: Renewal[]; low_stock_items: InventoryItem[] } | null; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <CardList title="Most Important Renewals" textMuted={textMuted} items={dashboard?.important_renewals.map((renewal) => `${renewal.title} (${renewal.status})`) ?? []} />
        <CardList title="Critical Renewals" textMuted={textMuted} items={dashboard?.critical_renewals.map((renewal) => `${renewal.title} (${renewal.expiration_date})`) ?? []} />
        <CardList title="Low Stock Alerts" textMuted={textMuted} items={dashboard?.low_stock_items.map((item) => `${item.name}: ${item.quantity_on_hand}/${item.minimum_on_hand}`) ?? []} />
      </div>
    </section>
  )
}

function RenewalsPage({ surface, textMuted, timezone, renewals, form, setForm, onCreate, onDelete, onSelect, canCreate, canDelete }: { surface: string; textMuted: string; timezone: string; renewals: Renewal[]; form: { title: string; category: string; expiration_date: string; workflow_status: string; auto_renews: boolean; notes: string }; setForm: (value: { title: string; category: string; expiration_date: string; workflow_status: string; auto_renews: boolean; notes: string }) => void; onCreate: () => Promise<void>; onDelete: (id: number) => Promise<void>; onSelect: (renewal: Renewal) => void; canCreate: boolean; canDelete: boolean }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <h2 className="text-lg font-semibold">Renewals</h2>
      {canCreate ? (
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Title</label>
            <input placeholder="Title" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Type</label>
            <select className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {renewalCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Expiration Date</label>
            <input type="date" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.expiration_date} onChange={(event) => setForm({ ...form, expiration_date: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Workflow Status</label>
            <select className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.workflow_status} onChange={(event) => setForm({ ...form, workflow_status: event.target.value })}>
              <option value="">Select status</option>
              {renewalWorkflowOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${surface}`}>
              <input type="checkbox" checked={form.auto_renews} onChange={(event) => setForm({ ...form, auto_renews: event.target.checked })} />
              Auto-renews
            </label>
          </div>
          <div className="flex items-end">
            <button className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onCreate()}>Create Renewal</button>
          </div>
        </div>
      ) : <p className={`mt-2 text-sm ${textMuted}`}>Your role cannot create renewal objects.</p>}

      <div className="mt-4 space-y-2">
        {renewals.map((renewal) => (
          <div key={renewal.id} className={`flex items-center justify-between rounded-md border p-3 ${surface}`}>
            <div>
              <p className="font-medium">{renewal.title}</p>
              <p className={`text-sm ${textMuted}`}>{formatRenewalCategory(renewal.category)} - Auto: {renewal.status}</p>
              <p className={`text-sm ${textMuted}`}>Workflow: {renewal.workflow_status || 'Not set'}</p>
              <p className={`text-sm ${textMuted}`}>Auto-renew: {renewal.auto_renews ? 'Yes' : 'No'}</p>
              <p className={`text-sm ${textMuted}`}>Expires: {formatDateTime(renewal.expiration_date, timezone)}</p>
            </div>
            <div className="flex gap-2">
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => onSelect(renewal)}>Open</button>
              {canDelete ? <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onDelete(renewal.id)}>Delete</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function InventoryPage({ surface, textMuted, timezone, items, form, setForm, onCreate, onDelete, onAdjust, onSelect, canCreate, canDelete }: { surface: string; textMuted: string; timezone: string; items: InventoryItem[]; form: { name: string; sku: string; quantity_on_hand: number; minimum_on_hand: number }; setForm: (value: { name: string; sku: string; quantity_on_hand: number; minimum_on_hand: number }) => void; onCreate: () => Promise<void>; onDelete: (id: number) => Promise<void>; onAdjust: (id: number, type: 'check_in' | 'check_out') => Promise<void>; onSelect: (item: InventoryItem) => void; canCreate: boolean; canDelete: boolean }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <h2 className="text-lg font-semibold">Inventory</h2>
      {canCreate ? (
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Item Name</label>
            <input placeholder="Item name" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>SKU</label>
            <input placeholder="SKU" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Quantity On Hand</label>
            <input type="number" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.quantity_on_hand} onChange={(event) => setForm({ ...form, quantity_on_hand: Number(event.target.value) })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Minimum On Hand</label>
            <input type="number" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={form.minimum_on_hand} onChange={(event) => setForm({ ...form, minimum_on_hand: Number(event.target.value) })} />
          </div>
          <div className="flex items-end">
            <button className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onCreate()}>Create Item</button>
          </div>
        </div>
      ) : <p className={`mt-2 text-sm ${textMuted}`}>Your role cannot create inventory items.</p>}

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${surface}`}>
            <div>
              <p className="font-medium">{item.name} ({item.sku})</p>
              <p className={`text-sm ${textMuted}`}>On hand: {item.quantity_on_hand} / Min: {item.minimum_on_hand}</p>
              <p className={`text-sm ${textMuted}`}>Created: {formatDateTime(item.created_at, timezone)}</p>
            </div>
            <div className="flex gap-2">
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => onSelect(item)}>Open</button>
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onAdjust(item.id, 'check_out')}>Check Out</button>
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onAdjust(item.id, 'check_in')}>Check In</button>
              {canDelete ? <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onDelete(item.id)}>Delete</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecycleBinPage({ surface, textMuted, data, reload, onRestore }: { surface: string; textMuted: string; data: { renewals: Renewal[]; inventory_items: InventoryItem[] } | null; reload: () => Promise<void>; onRestore: (entityType: 'renewal' | 'inventory', id: number) => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recycle Bin</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>

      <h3 className="text-sm font-semibold">Renewals</h3>
      <div className="space-y-2">
        {(data?.renewals ?? []).map((item) => (
          <div key={item.id} className={`flex items-center justify-between rounded-md border p-2 ${surface}`}>
            <span className={`text-sm ${textMuted}`}>{item.title}</span>
            <button className={`rounded-md border px-3 py-1 text-sm ${surface}`} onClick={() => void onRestore('renewal', item.id)}>Restore</button>
          </div>
        ))}
      </div>

      <h3 className="mt-4 text-sm font-semibold">Inventory</h3>
      <div className="space-y-2">
        {(data?.inventory_items ?? []).map((item) => (
          <div key={item.id} className={`flex items-center justify-between rounded-md border p-2 ${surface}`}>
            <span className={`text-sm ${textMuted}`}>{item.name}</span>
            <button className={`rounded-md border px-3 py-1 text-sm ${surface}`} onClick={() => void onRestore('inventory', item.id)}>Restore</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function TenantUsersPage({ surface, users, form, setForm, onCreate, onRemove, onToggleEdit, reload }: { surface: string; users: TenantUserMembership[]; form: { name: string; email: string; password: string; role: AppRole }; setForm: (value: { name: string; email: string; password: string; role: AppRole }) => void; onCreate: () => Promise<void>; onRemove: (id: number) => Promise<void>; onToggleEdit: (id: number, canEdit: boolean) => Promise<void>; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenant Users</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <select className={`rounded-md border px-3 py-2 text-sm ${surface}`} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })}>
          <option value="standard_user">Standard User</option>
          <option value="sub_admin">Sub Admin</option>
          <option value="tenant_admin">Tenant Admin</option>
        </select>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onCreate()}>Create User</button>
      </div>

      <div className="mt-4 space-y-2">
        {users.map((membership) => (
          <div key={membership.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${surface}`}>
            <div>
              <p className="font-medium">{membership.user.name} ({membership.user.email})</p>
              <p className="text-sm">{roleLabels[membership.role]} - Edit: {membership.can_edit ? 'Allowed' : 'Revoked'}</p>
            </div>
            <div className="flex gap-2">
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onToggleEdit(membership.user.id, membership.can_edit)}>{membership.can_edit ? 'Revoke Edit' : 'Allow Edit'}</button>
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onRemove(membership.user.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CustomFieldsPage({ surface, fields, form, setForm, onCreate, onDelete, reload }: { surface: string; fields: CustomField[]; form: { entity_type: 'renewal' | 'inventory'; name: string; key: string; field_type: string }; setForm: (value: { entity_type: 'renewal' | 'inventory'; name: string; key: string; field_type: string }) => void; onCreate: () => Promise<void>; onDelete: (id: number) => Promise<void>; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Custom Fields</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <select className={`rounded-md border px-3 py-2 text-sm ${surface}`} value={form.entity_type} onChange={(event) => setForm({ ...form, entity_type: event.target.value as 'renewal' | 'inventory' })}>
          <option value="renewal">Renewal</option>
          <option value="inventory">Inventory</option>
        </select>
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Key" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
        <select className={`rounded-md border px-3 py-2 text-sm ${surface}`} value={form.field_type} onChange={(event) => setForm({ ...form, field_type: event.target.value })}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Boolean</option>
          <option value="json">JSON</option>
        </select>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onCreate()}>Create Field</button>
      </div>

      <div className="mt-4 space-y-2">
        {fields.map((field) => (
          <div key={field.id} className={`flex items-center justify-between rounded-md border p-3 ${surface}`}>
            <div>
              <p className="font-medium">{field.name} ({field.key})</p>
              <p className="text-sm">{field.entity_type} - {field.field_type}</p>
            </div>
            <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onDelete(field.id)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function TenantAuditPage({ surface, timezone, data, reload }: { surface: string; timezone: string; data: { tenant_logs: Array<{ id: number; event: string; created_at: string }>; break_glass_logs: Array<{ id: number; event: string; created_at: string }> } | null; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenant Audit Logs</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CardList title="Tenant Events" textMuted="" items={(data?.tenant_logs ?? []).map((log) => `${log.event} (${formatDateTime(log.created_at, timezone)})`)} />
        <CardList title="Break-Glass Events" textMuted="" items={(data?.break_glass_logs ?? []).map((log) => `${log.event} (${formatDateTime(log.created_at, timezone)})`)} />
      </div>
    </section>
  )
}

function SuperadminTenantsPage({ surface, tenants, tenantForm, setTenantForm, tenantAdminForm, setTenantAdminForm, onCreate, onSuspend, onUnsuspend, onDelete, reload }: { surface: string; tenants: Tenant[]; tenantForm: { name: string; slug: string }; setTenantForm: (value: { name: string; slug: string }) => void; tenantAdminForm: { name: string; email: string; password: string }; setTenantAdminForm: (value: { name: string; email: string; password: string }) => void; onCreate: () => Promise<void>; onSuspend: (tenantId: string) => Promise<void>; onUnsuspend: (tenantId: string) => Promise<void>; onDelete: (tenantId: string) => Promise<void>; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Superadmin Tenant Management</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>

      <form
        className="grid gap-2 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate()
        }}
      >
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Tenant name" value={tenantForm.name} onChange={(event) => setTenantForm({ ...tenantForm, name: event.target.value })} required />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="tenant-slug" value={tenantForm.slug} onChange={(event) => setTenantForm({ ...tenantForm, slug: event.target.value })} required />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Tenant Admin Name" value={tenantAdminForm.name} onChange={(event) => setTenantAdminForm({ ...tenantAdminForm, name: event.target.value })} required />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Tenant Admin Email" value={tenantAdminForm.email} onChange={(event) => setTenantAdminForm({ ...tenantAdminForm, email: event.target.value })} type="email" autoComplete="email" required />
        <input className={`rounded-md border px-3 py-2 text-sm ${surface}`} placeholder="Tenant Admin Password" type="password" value={tenantAdminForm.password} onChange={(event) => setTenantAdminForm({ ...tenantAdminForm, password: event.target.value })} autoComplete="new-password" minLength={12} required />
        <button type="submit" className={`rounded-md border px-3 py-2 text-sm ${surface}`}>Create Tenant + Admin</button>
      </form>

      <div className="mt-4 space-y-2">
        {tenants.map((tenant) => (
          <div key={tenant.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${surface}`}>
            <div>
              <p className="font-medium">{tenant.name} ({tenant.slug})</p>
              <p className="text-sm">Status: {tenant.status}</p>
            </div>
            <div className="flex gap-2">
              {tenant.status === 'suspended' ? (
                <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onUnsuspend(tenant.id)}>Unsuspend</button>
              ) : (
                <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onSuspend(tenant.id)}>Suspend</button>
              )}
              <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onDelete(tenant.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SuperadminTenantAccessPage({
  surface,
  textMuted,
  tenants,
  selectedTenantId,
  setSelectedTenantId,
  breakGlassReason,
  setBreakGlassReason,
  breakGlassConfirmed,
  setBreakGlassConfirmed,
  breakGlassToken,
  startBreakGlass,
  stopBreakGlass,
  enterWorkspace,
}: {
  surface: string
  textMuted: string
  tenants: Tenant[]
  selectedTenantId: string
  setSelectedTenantId: (value: string) => void
  breakGlassReason: string
  setBreakGlassReason: (value: string) => void
  breakGlassConfirmed: boolean
  setBreakGlassConfirmed: (value: boolean) => void
  breakGlassToken: string
  startBreakGlass: () => Promise<void>
  stopBreakGlass: () => Promise<void>
  enterWorkspace: () => void
}) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <h2 className="text-lg font-semibold">Superadmin Tenant Access</h2>
      <p className={`mt-2 text-sm ${textMuted}`}>Use this workflow only when approved to enter tenant operations.</p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className={`rounded-md border px-3 py-2 text-sm ${surface}`}>
          <option value="">Select tenant</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.slug})</option>
          ))}
        </select>
        <input value={breakGlassReason} onChange={(event) => setBreakGlassReason(event.target.value)} placeholder="Break-glass reason" className={`rounded-md border px-3 py-2 text-sm ${surface}`} />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={breakGlassConfirmed} onChange={(event) => setBreakGlassConfirmed(event.target.checked)} />
        I confirm tenant permission was received
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {!breakGlassToken ? (
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void startBreakGlass()}>Start Break-Glass</button>
        ) : (
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void stopBreakGlass()}>End Break-Glass</button>
        )}
        <Link
          className={`rounded-md border px-3 py-2 text-sm ${surface}`}
          to="/app"
          onClick={(event) => {
            if (!selectedTenantId || !breakGlassToken) {
              event.preventDefault()
            }
            enterWorkspace()
          }}
        >
          Enter Tenant Workspace
        </Link>
      </div>

      <p className={`mt-2 text-xs ${textMuted}`}>{breakGlassToken ? 'Break-glass session is active.' : 'No active break-glass session.'}</p>
    </section>
  )
}

function GlobalAuditPage({ surface, logs, reload }: { surface: string; logs: Array<{ id: number; event: string; created_at: string }>; reload: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Global Audit Logs</h2>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void reload()}>Refresh</button>
      </div>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className={`rounded-md border p-3 text-sm ${surface}`}>{log.event} - {formatDateTime(log.created_at, 'UTC')}</div>
        ))}
      </div>
    </section>
  )
}

function TenantSettingsPage({ surface, textMuted, timezone, setTimezone, save }: { surface: string; textMuted: string; timezone: string; setTimezone: (value: string) => void; save: () => Promise<void> }) {
  return (
    <section className={`rounded-xl border p-4 ${surface}`}>
      <h2 className="text-lg font-semibold">Tenant Settings</h2>
      <p className={`mt-2 text-sm ${textMuted}`}>Set the tenant timezone used for date and time display.</p>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
        <select className={`rounded-md border px-3 py-2 text-sm ${surface}`} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {tenantTimezoneOptions.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
        <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void save()}>Save Timezone</button>
      </div>
    </section>
  )
}

function RenewalModal({ surface, textMuted, renewal, setRenewal, onSave, onClose }: { surface: string; textMuted: string; renewal: Renewal; setRenewal: (value: Renewal | null) => void; onSave: () => Promise<void>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-2xl rounded-xl border p-4 shadow-lg ${surface}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Renewal Detail</h3>
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Title</label>
            <input className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={renewal.title} onChange={(event) => setRenewal({ ...renewal, title: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Type</label>
            <select className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={renewal.category} onChange={(event) => setRenewal({ ...renewal, category: event.target.value })}>
              {renewalCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Expiration Date</label>
            <input type="date" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={renewal.expiration_date?.slice(0, 10) ?? ''} onChange={(event) => setRenewal({ ...renewal, expiration_date: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Workflow Status</label>
            <select className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={renewal.workflow_status ?? ''} onChange={(event) => setRenewal({ ...renewal, workflow_status: event.target.value })}>
              <option value="">Select status</option>
              {renewalWorkflowOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${surface}`}>
              <input type="checkbox" checked={Boolean(renewal.auto_renews)} onChange={(event) => setRenewal({ ...renewal, auto_renews: event.target.checked })} />
              Auto-renews
            </label>
          </div>
          <div className="md:col-span-2">
            <label className={`mb-1 block text-xs ${textMuted}`}>Notes</label>
            <textarea className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} rows={4} value={renewal.notes ?? ''} onChange={(event) => setRenewal({ ...renewal, notes: event.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onSave()}>Save Renewal</button>
        </div>
      </div>
    </div>
  )
}

function InventoryModal({ surface, textMuted, item, setItem, onSave, onClose }: { surface: string; textMuted: string; item: InventoryItem; setItem: (value: InventoryItem | null) => void; onSave: () => Promise<void>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-2xl rounded-xl border p-4 shadow-lg ${surface}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Inventory Detail</h3>
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Item Name</label>
            <input className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>SKU</label>
            <input className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.sku} disabled />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Quantity On Hand</label>
            <input type="number" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.quantity_on_hand} onChange={(event) => setItem({ ...item, quantity_on_hand: Number(event.target.value) })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Minimum On Hand</label>
            <input type="number" className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.minimum_on_hand} onChange={(event) => setItem({ ...item, minimum_on_hand: Number(event.target.value) })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Location</label>
            <input className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.location ?? ''} onChange={(event) => setItem({ ...item, location: event.target.value })} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${textMuted}`}>Vendor</label>
            <input className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} value={item.vendor ?? ''} onChange={(event) => setItem({ ...item, vendor: event.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className={`mb-1 block text-xs ${textMuted}`}>Notes</label>
            <textarea className={`w-full rounded-md border px-3 py-2 text-sm ${surface}`} rows={4} value={item.notes ?? ''} onChange={(event) => setItem({ ...item, notes: event.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className={`rounded-md border px-3 py-2 text-sm ${surface}`} onClick={() => void onSave()}>Save Inventory Item</button>
        </div>
      </div>
    </div>
  )
}

function CardList({ title, items, textMuted }: { title: string; items: string[]; textMuted: string }) {
  return (
    <div className="rounded-md border border-slate-600 p-3">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? <p className={`mt-2 text-sm ${textMuted || 'text-slate-400'}`}>No records.</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default App
