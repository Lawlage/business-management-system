import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { formatDate } from '../../lib/format'
import { RenewalDetailModal } from '../renewals/RenewalDetailModal'
import { InventoryDetailModal } from '../inventory/InventoryDetailModal'
import type { Renewal, StockAllocation, Client, InventoryItem } from '../../types'

type TabId =
  | 'renewal-status'
  | 'renewals-by-client'
  | 'renewals-expiring'
  | 'inventory-summary'
  | 'stock-movements'
  | 'stock-allocations'
  | 'client-portfolio'

const TABS: { id: TabId; label: string }[] = [
  { id: 'renewal-status', label: 'Renewal Status' },
  { id: 'renewals-by-client', label: 'By Client' },
  { id: 'renewals-expiring', label: 'Expiring' },
  { id: 'inventory-summary', label: 'Inventory' },
  { id: 'stock-movements', label: 'Stock Movements' },
  { id: 'stock-allocations', label: 'Allocations' },
  { id: 'client-portfolio', label: 'Client Portfolio' },
]

const today = new Date().toISOString().slice(0, 10)
const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

type InventorySummaryRow = {
  id: number; name: string; sku: string; quantity_on_hand: number
  minimum_on_hand: number; allocated_quantity: number; is_low_stock: boolean
  location: string | null; vendor: string | null
}

function ReportsContent() {
  const { selectedTenantId, tenantTimezone, breakGlassToken, role } = useTenant()
  const { token } = useAuth()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [tab, setTab] = useState<TabId>('renewal-status')

  // Filters per tab
  const [expiringFrom, setExpiringFrom] = useState(today)
  const [expiringTo, setExpiringTo] = useState(in30)
  const [movementsFrom, setMovementsFrom] = useState(today)
  const [movementsTo, setMovementsTo] = useState(today)
  const [portfolioClientId, setPortfolioClientId] = useState('')
  const [allocationStatus, setAllocationStatus] = useState('')

  // Modal state for clickable rows
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null)
  const [selectedInventory, setSelectedInventory] = useState<InventorySummaryRow | null>(null)

  // Run state — user must press Run before fetching (except always-on tabs)
  const [runKey, setRunKey] = useState(0)
  const run = () => setRunKey((k) => k + 1)

  const buildUrl = (path: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return `/api/reports/${path}${qs ? '?' + qs : ''}`
  }

  const { data: renewalStatus, isLoading: loadingRS } = useQuery<
    { status: string; count: number; renewals: Renewal[] }[]
  >({
    queryKey: ['report', 'renewal-status', selectedTenantId],
    queryFn: () =>
      authedFetch(buildUrl('renewal-status'), { tenantScoped: true }),
    enabled: !!selectedTenantId && tab === 'renewal-status',
    staleTime: 0,
  })

  const { data: byClient, isLoading: loadingBC } = useQuery<
    { client_name: string; count: number; renewals: Renewal[] }[]
  >({
    queryKey: ['report', 'renewals-by-client', selectedTenantId],
    queryFn: () =>
      authedFetch(buildUrl('renewals-by-client'), { tenantScoped: true }),
    enabled: !!selectedTenantId && tab === 'renewals-by-client',
    staleTime: 0,
  })

  const { data: expiring, isLoading: loadingExp } = useQuery<Renewal[]>({
    queryKey: ['report', 'renewals-expiring', selectedTenantId, expiringFrom, expiringTo, runKey],
    queryFn: () =>
      authedFetch(buildUrl('renewals-expiring', { from: expiringFrom, to: expiringTo }), {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && tab === 'renewals-expiring' && runKey > 0,
    staleTime: 0,
  })

  const { data: inventory, isLoading: loadingInv } = useQuery<InventorySummaryRow[]>({
    queryKey: ['report', 'inventory-summary', selectedTenantId],
    queryFn: () =>
      authedFetch(buildUrl('inventory-summary'), { tenantScoped: true }),
    enabled: !!selectedTenantId && tab === 'inventory-summary',
    staleTime: 0,
  })

  const { data: movements, isLoading: loadingMov } = useQuery<
    { id: number; type: string; quantity: number; reason: string | null; created_at: string; inventory_item: { name: string; sku: string } }[]
  >({
    queryKey: ['report', 'stock-movements', selectedTenantId, movementsFrom, movementsTo, runKey],
    queryFn: () =>
      authedFetch(buildUrl('stock-movements', { from: movementsFrom, to: movementsTo }), {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && tab === 'stock-movements' && runKey > 0,
    staleTime: 0,
  })

  const { data: allocations, isLoading: loadingAlloc } = useQuery<StockAllocation[]>({
    queryKey: ['report', 'stock-allocations', selectedTenantId, allocationStatus],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (allocationStatus) params.status = allocationStatus
      return authedFetch(buildUrl('stock-allocations', params), { tenantScoped: true })
    },
    enabled: !!selectedTenantId && tab === 'stock-allocations',
    staleTime: 0,
  })

  const { data: portfolioClients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () => authedFetch<Client[]>('/api/clients?all=true', { tenantScoped: true }),
    enabled: !!selectedTenantId && tab === 'client-portfolio',
    staleTime: 30000,
  })

  const { data: portfolio, isLoading: loadingPort } = useQuery<{
    client: { id: number; name: string }
    renewals: Renewal[]
    allocations: StockAllocation[]
    renewal_count: number
    active_allocated_quantity: number
  }>({
    queryKey: ['report', 'client-portfolio', selectedTenantId, portfolioClientId, runKey],
    queryFn: () =>
      authedFetch(buildUrl('client-portfolio', { client_id: portfolioClientId }), {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && tab === 'client-portfolio' && runKey > 0 && !!portfolioClientId,
    staleTime: 0,
  })

  const exportCsv = (path: string, params: Record<string, string> = {}) => {
    if (!token || !selectedTenantId) return
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString()
    const url = `/api/reports/${path}?${qs}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': selectedTenantId,
    }
    if (role === 'global_superadmin' && breakGlassToken) {
      headers['X-Break-Glass-Token'] = breakGlassToken
    }
    fetch(url, { headers })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${path}-${today}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => showNotice('CSV export failed.', 'error'))
  }

  const canEdit = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'
  const canDelete = role === 'tenant_admin' || role === 'global_superadmin'

  return (
    <Card>
      <PageHeader title="Reports" />

      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--ui-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setRunKey(0) }}
            className={[
              'px-4 py-2 text-sm font-medium transition whitespace-nowrap',
              tab === t.id
                ? 'border-b-2 border-[var(--ui-button-bg)] text-[var(--ui-button-bg)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Renewal Status ── */}
      {tab === 'renewal-status' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => exportCsv('renewal-status')}>
              Export CSV
            </Button>
          </div>
          {loadingRS ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
          ) : !renewalStatus || renewalStatus.length === 0 ? (
            <EmptyState message="No renewals found." />
          ) : (
            renewalStatus.map((group) => (
              <div key={group.status} className="rounded-md border border-[var(--ui-border)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--ui-inner-bg)]">
                  <Badge status={group.status} />
                  <span className="text-sm text-[var(--ui-muted)]">{group.count} renewal{group.count !== 1 ? 's' : ''}</span>
                </div>
                {group.renewals.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRenewal(r)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-2 border-t border-[var(--ui-border)] text-left hover:bg-[var(--ui-inner-bg)] transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--ui-text)]">{r.title}</p>
                      <p className="text-xs text-[var(--ui-muted)]">{r.client?.name ?? 'No client'} · {r.category}</p>
                    </div>
                    <span className="text-xs text-[var(--ui-muted)] shrink-0">{formatDate(r.expiration_date)}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Renewals By Client ── */}
      {tab === 'renewals-by-client' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => exportCsv('renewals-by-client')}>
              Export CSV
            </Button>
          </div>
          {loadingBC ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
          ) : !byClient || byClient.length === 0 ? (
            <EmptyState message="No renewals found." />
          ) : (
            byClient.map((group) => (
              <div key={group.client_name} className="rounded-md border border-[var(--ui-border)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--ui-inner-bg)]">
                  <span className="text-sm font-semibold text-[var(--ui-text)]">{group.client_name}</span>
                  <span className="text-sm text-[var(--ui-muted)]">{group.count}</span>
                </div>
                {group.renewals.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRenewal(r)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-2 border-t border-[var(--ui-border)] text-left hover:bg-[var(--ui-inner-bg)] transition"
                  >
                    <div>
                      <p className="text-sm text-[var(--ui-text)]">{r.title}</p>
                      <p className="text-xs text-[var(--ui-muted)]">{r.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge status={r.status} />
                      <span className="text-xs text-[var(--ui-muted)]">{formatDate(r.expiration_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Renewals Expiring ── */}
      {tab === 'renewals-expiring' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">From</label>
              <input type="date" value={expiringFrom} onChange={(e) => setExpiringFrom(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">To</label>
              <input type="date" value={expiringTo} onChange={(e) => setExpiringTo(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]" />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={run}>Run</Button>
              {expiring && expiring.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => exportCsv('renewals-expiring', { from: expiringFrom, to: expiringTo })}>
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          {loadingExp ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
          ) : !expiring ? null : expiring.length === 0 ? (
            <EmptyState message="No renewals expiring in this range." />
          ) : (
            <div className="space-y-2">
              {expiring.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRenewal(r)}
                  className="w-full app-inner-box flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] p-3 text-left hover:bg-[var(--ui-inner-bg)] transition"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--ui-text)]">{r.title}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{r.client?.name ?? 'No client'} · {r.category}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={r.status} />
                    <span className="text-xs text-[var(--ui-muted)]">{formatDate(r.expiration_date)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Inventory Summary ── */}
      {tab === 'inventory-summary' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => exportCsv('inventory-summary')}>
              Export CSV
            </Button>
          </div>
          {loadingInv ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
          ) : !inventory || inventory.length === 0 ? (
            <EmptyState message="No inventory items." />
          ) : (
            <>
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                <span>Item</span>
                <span>On Hand</span>
                <span>Minimum</span>
                <span>Allocated</span>
                <span>Low Stock</span>
                <span>Location</span>
              </div>
              <div className="space-y-2">
                {inventory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedInventory(item)}
                    className={[
                      'w-full app-inner-box grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 rounded-md border p-3 items-center text-left hover:bg-[var(--ui-inner-bg)] transition',
                      item.is_low_stock ? 'border-red-400/60' : 'border-[var(--ui-border)]',
                    ].join(' ')}
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--ui-text)]">{item.name}</p>
                      <p className="text-xs text-[var(--ui-muted)]">{item.sku}</p>
                    </div>
                    <span className="text-sm text-[var(--ui-text)]">{item.quantity_on_hand}</span>
                    <span className="text-sm text-[var(--ui-muted)]">{item.minimum_on_hand}</span>
                    <span className="text-sm text-[var(--ui-muted)]">{item.allocated_quantity}</span>
                    <span>{item.is_low_stock ? <Badge status="Low" /> : <Badge status="OK" />}</span>
                    <span className="text-xs text-[var(--ui-muted)] truncate">{item.location ?? '—'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Stock Movements ── */}
      {tab === 'stock-movements' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">From</label>
              <input type="date" value={movementsFrom} onChange={(e) => setMovementsFrom(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">To</label>
              <input type="date" value={movementsTo} onChange={(e) => setMovementsTo(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]" />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={run}>Run</Button>
              {movements && movements.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => exportCsv('stock-movements', { from: movementsFrom, to: movementsTo })}>
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          {loadingMov ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
          ) : !movements ? null : movements.length === 0 ? (
            <EmptyState message="No movements in this date range." />
          ) : (
            <div className="space-y-2">
              {movements.map((t) => (
                <div key={t.id} className="app-inner-box flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] p-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--ui-text)]">{t.inventory_item?.name}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{t.inventory_item?.sku} · {t.reason ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <Badge status={t.type} />
                    <span className="text-[var(--ui-text)]">×{t.quantity}</span>
                    <span className="text-xs text-[var(--ui-muted)]">{formatDate(t.created_at, tenantTimezone)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stock Allocations ── */}
      {tab === 'stock-allocations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">Status</label>
              <select
                value={allocationStatus}
                onChange={(e) => setAllocationStatus(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]"
              >
                <option value="">All</option>
                <option value="allocated">Allocated</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex gap-2 pb-0.5">
              {allocations && allocations.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => exportCsv('stock-allocations', allocationStatus ? { status: allocationStatus } : {})}>
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          {loadingAlloc ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
          ) : !allocations || allocations.length === 0 ? (
            <EmptyState message="No allocations found." />
          ) : (
            <div className="space-y-2">
              {allocations.map((a) => (
                <div key={a.id} className="app-inner-box flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] p-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--ui-text)]">{a.inventory_item?.name}</p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      → {a.client?.name} · Qty: {a.quantity}
                      {a.unit_price ? ` · $${a.unit_price} ea` : ''}
                      {a.unit_price ? ` · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={a.status} />
                    <span className="text-xs text-[var(--ui-muted)]">{formatDate(a.created_at, tenantTimezone)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Client Portfolio ── */}
      {tab === 'client-portfolio' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">Client</label>
              <select
                value={portfolioClientId}
                onChange={(e) => setPortfolioClientId(e.target.value)}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60 min-w-[200px]"
              >
                <option value="">— Select client —</option>
                {portfolioClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button variant="primary" size="sm" onClick={run} disabled={!portfolioClientId}>Run</Button>
              {portfolio && (
                <Button size="sm" variant="secondary" onClick={() => exportCsv('client-portfolio', { client_id: portfolioClientId })}>
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          {loadingPort ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
          ) : !portfolio ? null : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-inner-bg)] px-4 py-3">
                <span className="font-semibold text-[var(--ui-text)]">{portfolio.client.name}</span>
                <div className="flex gap-4 text-sm text-[var(--ui-muted)]">
                  <span>{portfolio.renewal_count} renewals</span>
                  <span>{portfolio.active_allocated_quantity} units allocated</span>
                </div>
              </div>

              {portfolio.renewals.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">Renewals</p>
                  <div className="space-y-2">
                    {portfolio.renewals.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRenewal(r)}
                        className="w-full app-inner-box flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] p-3 text-left hover:bg-[var(--ui-inner-bg)] transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--ui-text)]">{r.title}</p>
                          <p className="text-xs text-[var(--ui-muted)]">{r.category}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge status={r.status} />
                          <span className="text-xs text-[var(--ui-muted)]">{formatDate(r.expiration_date)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {portfolio.allocations.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">Stock Allocations</p>
                  <div className="space-y-2">
                    {portfolio.allocations.map((a) => (
                      <div key={a.id} className="app-inner-box flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] p-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--ui-text)]">{a.inventory_item?.name}</p>
                          <p className="text-xs text-[var(--ui-muted)]">
                            Qty: {a.quantity}
                            {a.unit_price ? ` · $${a.unit_price} ea` : ''}
                            {a.unit_price ? ` · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge status={a.status} />
                          <span className="text-xs text-[var(--ui-muted)]">{formatDate(a.created_at, tenantTimezone)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail modals for clickable rows */}
      {selectedRenewal && (
        <RenewalDetailModal
          renewal={selectedRenewal}
          onClose={() => setSelectedRenewal(null)}
          onUpdated={() => setSelectedRenewal(null)}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      )}
      {selectedInventory && (
        <InventoryDetailModal
          item={selectedInventory as InventoryItem}
          onClose={() => setSelectedInventory(null)}
          onUpdated={() => setSelectedInventory(null)}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      )}
    </Card>
  )
}

export function ReportsPage() {
  return (
    <ErrorBoundary>
      <ReportsContent />
    </ErrorBoundary>
  )
}
