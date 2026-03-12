import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppRole, Tenant, TenantUiSettings } from '../types'
import { defaultTenantUiSettings } from '../uiSettings'
import { useAuth } from './AuthContext'

type TenantContextType = {
  selectedTenantId: string
  setSelectedTenantId: (id: string) => void
  superTenants: Tenant[]
  setSuperTenants: React.Dispatch<React.SetStateAction<Tenant[]>>
  tenantTimezone: string
  setTenantTimezone: React.Dispatch<React.SetStateAction<string>>
  tenantUiSettings: TenantUiSettings
  setTenantUiSettings: React.Dispatch<React.SetStateAction<TenantUiSettings>>
  isSuperadminTenantWorkspace: boolean
  setIsSuperadminTenantWorkspace: React.Dispatch<React.SetStateAction<boolean>>
  breakGlassToken: string
  setBreakGlassToken: React.Dispatch<React.SetStateAction<string>>
  role: AppRole
  selectedTenant: Tenant | null
  canManageTenantAdminPages: boolean
  canEditRecords: boolean
}

const TenantContext = createContext<TenantContextType | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [selectedTenantId, setSelectedTenantIdRaw] = useState('')
  const [superTenants, setSuperTenants] = useState<Tenant[]>([])
  const [tenantTimezone, setTenantTimezone] = useState('Pacific/Auckland')
  const [tenantUiSettings, setTenantUiSettings] = useState<TenantUiSettings>(defaultTenantUiSettings)
  const [isSuperadminTenantWorkspace, setIsSuperadminTenantWorkspace] = useState(false)
  const [breakGlassToken, setBreakGlassToken] = useState('')

  const role = useMemo<AppRole>(() => {
    if (!user) return 'standard_user'
    if (user.is_global_superadmin) return 'global_superadmin'
    const membership = selectedTenantId
      ? user.tenant_memberships.find((m) => m.tenant_id === selectedTenantId)
      : user.tenant_memberships[0]
    return membership?.role ?? 'standard_user'
  }, [user, selectedTenantId])

  const selectedTenant = useMemo<Tenant | null>(() => {
    if (!selectedTenantId) return null
    if (role === 'global_superadmin') {
      return superTenants.find((t) => t.id === selectedTenantId) ?? null
    }
    return user?.tenant_memberships.find((m) => m.tenant_id === selectedTenantId)?.tenant ?? null
  }, [selectedTenantId, role, superTenants, user])

  const canManageTenantAdminPages =
    role === 'tenant_admin' || (role === 'global_superadmin' && isSuperadminTenantWorkspace)

  const canEditRecords = role !== 'standard_user'

  const setSelectedTenantId = (id: string) => {
    setSelectedTenantIdRaw(id)
  }

  return (
    <TenantContext.Provider
      value={{
        selectedTenantId,
        setSelectedTenantId,
        superTenants,
        setSuperTenants,
        tenantTimezone,
        setTenantTimezone,
        tenantUiSettings,
        setTenantUiSettings,
        isSuperadminTenantWorkspace,
        setIsSuperadminTenantWorkspace,
        breakGlassToken,
        setBreakGlassToken,
        role,
        selectedTenant,
        canManageTenantAdminPages,
        canEditRecords,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextType {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}
