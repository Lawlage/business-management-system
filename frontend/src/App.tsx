import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import { NoticeProvider, useNotice } from './contexts/NoticeContext'
import { ConfirmProvider, useConfirm } from './contexts/ConfirmContext'

import { applyUiTheme, normalizeUiSettings } from './uiSettings'
import { useApi } from './hooks/useApi'

import type { Renewal, InventoryItem, TenantUiSettings } from './types'

import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { NoticeToast } from './components/NoticeToast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { SkeletonRow } from './components/SkeletonRow'
import { ErrorBoundary } from './components/ErrorBoundary'

import { LoginPage } from './features/auth/LoginPage'

// Lazy-loaded feature pages (Phase 7: code splitting)
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const RenewalsPage = lazy(() => import('./features/renewals/RenewalsPage').then((m) => ({ default: m.RenewalsPage })))
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const RecycleBinPage = lazy(() => import('./features/recycle-bin/RecycleBinPage').then((m) => ({ default: m.RecycleBinPage })))
const UsersPage = lazy(() => import('./features/admin/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const CustomFieldsPage = lazy(() => import('./features/admin/custom-fields/CustomFieldsPage').then((m) => ({ default: m.CustomFieldsPage })))
const TenantSettingsPage = lazy(() => import('./features/admin/settings/TenantSettingsPage').then((m) => ({ default: m.TenantSettingsPage })))
const AuditLogsPage = lazy(() => import('./features/admin/audit/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })))
const TenantsPage = lazy(() => import('./features/superadmin/TenantsPage').then((m) => ({ default: m.TenantsPage })))
const GlobalAuditPage = lazy(() => import('./features/superadmin/GlobalAuditPage').then((m) => ({ default: m.GlobalAuditPage })))
const BreakGlassPage = lazy(() => import('./features/superadmin/BreakGlassPage').then((m) => ({ default: m.BreakGlassPage })))

// Lazy-loaded modals (only needed when opened from dashboard)
const RenewalDetailModal = lazy(() => import('./features/renewals/RenewalDetailModal').then((m) => ({ default: m.RenewalDetailModal })))
const InventoryDetailModal = lazy(() => import('./features/inventory/InventoryDetailModal').then((m) => ({ default: m.InventoryDetailModal })))

function PageLoader() {
  return (
    <div className="space-y-2">
      <SkeletonRow cols={4} />
      <SkeletonRow cols={4} />
      <SkeletonRow cols={4} />
    </div>
  )
}

function AppContent() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isLoading, isAuthenticated, user, token, logout } = useAuth()
  const {
    role,
    selectedTenantId,
    setSelectedTenantId,
    tenantUiSettings,
    setTenantTimezone,
    setTenantUiSettings,
    isSuperadminTenantWorkspace,
    setIsSuperadminTenantWorkspace,
    breakGlassToken,
    setBreakGlassToken,
    setSuperTenants,
    canManageTenantAdminPages,
    canEditRecords,
  } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  // Light/dark mode — defaults to light, persisted in localStorage
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('colorMode') as 'light' | 'dark') ?? 'light'
  })
  const toggleColorMode = () => {
    setColorMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('colorMode', next)
      return next
    })
  }

  // Modals opened from dashboard
  const [dashboardRenewal, setDashboardRenewal] = useState<Renewal | null>(null)
  const [dashboardInventory, setDashboardInventory] = useState<InventoryItem | null>(null)

  // Auto-select first tenant for regular users after login
  useEffect(() => {
    if (!user || user.is_global_superadmin) return
    if (!selectedTenantId && user.tenant_memberships[0]?.tenant_id) {
      setSelectedTenantId(user.tenant_memberships[0].tenant_id)
    }
  }, [user, selectedTenantId, setSelectedTenantId])

  // Apply UI theme whenever tenant settings or color mode change
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark')
    applyUiTheme(colorMode, tenantUiSettings)
  }, [colorMode, tenantUiSettings])

  // Load superadmin tenant list (used to populate sidebar/topbar and tenant selector)
  const superAdminTenantsEnabled = role === 'global_superadmin' && isAuthenticated
  const { data: superTenantsData } = useQuery({
    queryKey: ['superadmin-tenants'],
    queryFn: () => authedFetch<{ id: string; name: string; slug: string; status: string }[]>('/api/superadmin/tenants'),
    enabled: superAdminTenantsEnabled,
  })
  useEffect(() => {
    if (!superTenantsData) return
    setSuperTenants(superTenantsData)
    if (!selectedTenantId && superTenantsData.length > 0) {
      setSelectedTenantId(superTenantsData[0].id)
    }
  }, [superTenantsData, selectedTenantId, setSuperTenants, setSelectedTenantId])

  // Load tenant settings (timezone + UI theme) when active tenant changes
  const tenantSettingsEnabled =
    isAuthenticated &&
    !!selectedTenantId &&
    (role === 'tenant_admin' || (role === 'global_superadmin' && isSuperadminTenantWorkspace && !!breakGlassToken))
  const { data: settingsData } = useQuery({
    queryKey: ['tenant-settings', selectedTenantId],
    queryFn: () =>
      authedFetch<{ timezone: string; ui_settings?: Partial<TenantUiSettings> }>('/api/tenant-settings', {
        tenantScoped: true,
      }),
    enabled: tenantSettingsEnabled,
  })
  useEffect(() => {
    if (!settingsData) return
    setTenantTimezone(settingsData.timezone || 'Pacific/Auckland')
    setTenantUiSettings(normalizeUiSettings(settingsData.ui_settings))
  }, [settingsData, setTenantTimezone, setTenantUiSettings])

  const handleLogout = async () => {
    try {
      if (token) await authedFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore transport failures — clear local session regardless
    }
    queryClient.clear()
    setSelectedTenantId('')
    setSuperTenants([])
    setBreakGlassToken('')
    setIsSuperadminTenantWorkspace(false)
    logout()
  }

  const handleStopBreakGlass = async () => {
    const confirmed = await confirm({
      title: 'End break-glass session?',
      message: 'You will exit tenant workspace and return to superadmin mode.',
      confirmLabel: 'End Session',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await authedFetch(
        `/api/superadmin/tenants/${selectedTenantId}/break-glass/${breakGlassToken}/stop`,
        { method: 'POST' },
      )
      setBreakGlassToken('')
      setIsSuperadminTenantWorkspace(false)
      showNotice('Break-glass session ended.')
    } catch (err) {
      showNotice((err as { message?: string })?.message ?? 'Failed to end session.', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center text-[var(--ui-text)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-[var(--ui-accent)]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (location.pathname !== '/login') return <Navigate to="/login" replace />
    return <LoginPage />
  }

  if (location.pathname === '/login') {
    return <Navigate to={role === 'global_superadmin' ? '/superadmin' : '/app'} replace />
  }

  const defaultRedirect = role === 'global_superadmin' ? '/superadmin' : '/app'

  return (
    <div className={`app-shell density-${tenantUiSettings.density} flex h-screen flex-col overflow-hidden text-[var(--ui-text)]`}>
      <TopBar
        onLogout={() => void handleLogout()}
        onStopBreakGlass={() => void handleStopBreakGlass()}
        colorMode={colorMode}
        onToggleColorMode={toggleColorMode}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={role} isSuperadminTenantWorkspace={isSuperadminTenantWorkspace} />

        <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-6">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
                <Route path="/login" element={<Navigate to={defaultRedirect} replace />} />

                {/* Tenant workspace routes */}
                <Route
                  path="/app"
                  element={
                    role === 'global_superadmin' && !isSuperadminTenantWorkspace
                      ? <Navigate to="/superadmin/access" replace />
                      : <DashboardPage onOpenRenewal={setDashboardRenewal} onOpenInventory={setDashboardInventory} />
                  }
                />
                <Route
                  path="/app/renewals"
                  element={
                    role === 'global_superadmin' && !isSuperadminTenantWorkspace
                      ? <Navigate to="/superadmin/access" replace />
                      : <RenewalsPage onOpenRenewal={setDashboardRenewal} />
                  }
                />
                <Route
                  path="/app/inventory"
                  element={
                    role === 'global_superadmin' && !isSuperadminTenantWorkspace
                      ? <Navigate to="/superadmin/access" replace />
                      : <InventoryPage onOpenItem={setDashboardInventory} />
                  }
                />
                <Route
                  path="/app/recycle-bin"
                  element={
                    role === 'global_superadmin' && !isSuperadminTenantWorkspace
                      ? <Navigate to="/superadmin/access" replace />
                      : <RecycleBinPage />
                  }
                />

                {/* Admin routes */}
                <Route path="/app/admin/users" element={canManageTenantAdminPages ? <UsersPage /> : <Navigate to="/app" replace />} />
                <Route path="/app/admin/custom-fields" element={canManageTenantAdminPages ? <CustomFieldsPage /> : <Navigate to="/app" replace />} />
                <Route path="/app/admin/tenant-settings" element={canManageTenantAdminPages ? <TenantSettingsPage /> : <Navigate to="/app" replace />} />
                <Route path="/app/admin/audit" element={canManageTenantAdminPages ? <AuditLogsPage /> : <Navigate to="/app" replace />} />

                {/* Superadmin routes */}
                <Route path="/superadmin" element={role === 'global_superadmin' ? <TenantsPage /> : <Navigate to="/app" replace />} />
                <Route path="/superadmin/audit" element={role === 'global_superadmin' ? <GlobalAuditPage /> : <Navigate to="/app" replace />} />
                <Route path="/superadmin/access" element={role === 'global_superadmin' ? <BreakGlassPage /> : <Navigate to="/app" replace />} />

                <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>

          {/* Modals opened from dashboard */}
          {dashboardRenewal && (
            <Suspense fallback={null}>
              <RenewalDetailModal
                renewal={dashboardRenewal}
                onClose={() => setDashboardRenewal(null)}
                onUpdated={() => {
                  void queryClient.invalidateQueries({ queryKey: ['dashboard', selectedTenantId] })
                  void queryClient.invalidateQueries({ queryKey: ['renewals', selectedTenantId] })
                }}
                canDelete={role === 'tenant_admin' || role === 'global_superadmin'}
                canEdit={canEditRecords}
              />
            </Suspense>
          )}
          {dashboardInventory && (
            <Suspense fallback={null}>
              <InventoryDetailModal
                item={dashboardInventory}
                onClose={() => setDashboardInventory(null)}
                onUpdated={() => {
                  void queryClient.invalidateQueries({ queryKey: ['dashboard', selectedTenantId] })
                  void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
                }}
                canDelete={role === 'tenant_admin' || role === 'global_superadmin'}
                canEdit={canEditRecords}
              />
            </Suspense>
          )}
        </main>
      </div> {/* flex row: sidebar + main */}

      <NoticeToast />
      <ConfirmDialog />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <NoticeProvider>
          <ConfirmProvider>
            <AppContent />
          </ConfirmProvider>
        </NoticeProvider>
      </TenantProvider>
    </AuthProvider>
  )
}
