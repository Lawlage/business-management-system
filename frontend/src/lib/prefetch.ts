import type { QueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Chunk prefetchers
// Calling these kicks off the Vite dynamic import so the JS module is already
// in the browser module cache by the time the user clicks the link.
// ---------------------------------------------------------------------------
export const chunkPrefetchers: Record<string, () => Promise<unknown>> = {
  '/app':                       () => import('../features/dashboard/DashboardPage'),
  '/app/clients':               () => import('../features/clients/ClientsPage'),
  '/app/products':              () => import('../features/products/ProductsPage'),
  '/app/client-services':       () => import('../features/client-services/ClientServicesPage'),
  '/app/inventory':             () => import('../features/inventory/InventoryPage'),
  '/app/allocations':           () => import('../features/stock-allocations/StockAllocationsPage'),
  '/app/reports':               () => import('../features/reports/ReportsPage'),
  '/app/sla-items':             () => import('../features/sla-items/SlaItemsPage'),
  '/app/recycle-bin':           () => import('../features/recycle-bin/RecycleBinPage'),
  '/app/admin/users':           () => import('../features/admin/users/UsersPage'),
  '/app/admin/departments':     () => import('../features/admin/departments/DepartmentsPage'),
  '/app/admin/custom-fields':   () => import('../features/admin/custom-fields/CustomFieldsPage'),
  '/app/admin/tenant-settings': () => import('../features/admin/settings/TenantSettingsPage'),
  '/app/admin/audit':           () => import('../features/admin/audit/AuditLogsPage'),
  '/superadmin':                () => import('../features/superadmin/TenantsPage'),
  '/superadmin/audit':          () => import('../features/superadmin/GlobalAuditPage'),
  '/superadmin/access':         () => import('../features/superadmin/BreakGlassPage'),
}

// ---------------------------------------------------------------------------
// Data prefetchers
// Prefetch the default (no-filter, page 1) query for each page.
// Skipped for pages that always use staleTime: 0 (dashboard, audit, reports)
// since prefetched data would be discarded on mount anyway.
// ---------------------------------------------------------------------------
type FetchFn = (url: string, opts?: { tenantScoped?: boolean }) => Promise<unknown>

type PrefetchCtx = {
  queryClient: QueryClient
  authedFetch: FetchFn
  tenantId: string
}

export const dataPrefetchers: Record<string, (ctx: PrefetchCtx) => void> = {
  '/app/client-services': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['client-services', tenantId, '', '', '', '', '', 1],
      queryFn: () => authedFetch('/api/client-services?page=1', { tenantScoped: true }),
    })
    void queryClient.prefetchQuery({
      queryKey: ['clients-all', tenantId],
      queryFn: () => authedFetch('/api/clients?all=1', { tenantScoped: true }),
    })
  },

  '/app/inventory': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['inventory', tenantId, '', 1],
      queryFn: () => authedFetch('/api/inventory?page=1', { tenantScoped: true }),
    })
  },

  '/app/clients': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['clients', tenantId, '', 1],
      queryFn: () => authedFetch('/api/clients?page=1', { tenantScoped: true }),
    })
  },

  '/app/products': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['products', tenantId, '', 1],
      queryFn: () => authedFetch('/api/products?page=1', { tenantScoped: true }),
    })
  },

  '/app/sla-items': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['sla-items', tenantId, '', 1],
      queryFn: () => authedFetch('/api/sla-items?page=1', { tenantScoped: true }),
    })
  },

  '/app/allocations': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['stock-allocations', tenantId, '', 1],
      queryFn: () => authedFetch('/api/stock-allocations?page=1', { tenantScoped: true }),
    })
  },

  '/app/admin/users': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['tenant-users', tenantId],
      queryFn: () => authedFetch('/api/tenant-users', { tenantScoped: true }),
    })
  },

  '/app/admin/departments': ({ queryClient, authedFetch, tenantId }) => {
    void queryClient.prefetchQuery({
      queryKey: ['departments', tenantId],
      queryFn: () => authedFetch('/api/departments', { tenantScoped: true }),
    })
  },
}
