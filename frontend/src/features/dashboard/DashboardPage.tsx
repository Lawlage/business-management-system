import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { SkeletonRow } from '../../components/SkeletonRow'
import { EmptyState } from '../../components/EmptyState'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { formatDate } from '../../lib/format'
import type { DashboardData, Renewal, InventoryItem, SlaAllocation, Client, PaginatedResponse } from '../../types'

type DashboardPageProps = {
  onOpenRenewal: (renewal: Renewal) => void
  onOpenInventory: (item: InventoryItem) => void
}

const itemButtonClass =
  'app-inner-box w-full cursor-pointer rounded-md border border-[var(--ui-border)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--ui-accent)]/80 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/80'

function RenewalRow({ r, onClick, tenantTimezone }: { r: Renewal; onClick: () => void; tenantTimezone: string }) {
  return (
    <button className={itemButtonClass} onClick={onClick}>
      <p className="font-medium text-sm text-[var(--ui-text)]">{r.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge status={r.status} />
        <span className="text-xs text-[var(--ui-muted)]">
          {formatDate(r.expiration_date, tenantTimezone)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {r.client && (
          <span className="text-xs text-[var(--ui-muted)]">
            Client: <span className="text-[var(--ui-text)]">{r.client.name}</span>
          </span>
        )}
        {r.department && (
          <span className="text-xs text-[var(--ui-muted)]">
            Dept: <span className="text-[var(--ui-text)]">{r.department.name}</span>
          </span>
        )}
        {r.workflow_status && (
          <span className="text-xs text-[var(--ui-muted)]">
            Status: <span className="text-[var(--ui-text)]">{r.workflow_status}</span>
          </span>
        )}
      </div>
    </button>
  )
}

function DashboardContent({ onOpenRenewal, onOpenInventory }: DashboardPageProps) {
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { authedFetch } = useApi()
  const [filterClientId, setFilterClientId] = useState('')

  const { data: clientsData } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients-list', selectedTenantId],
    queryFn: () => authedFetch<PaginatedResponse<Client>>('/api/clients?per_page=200', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 60_000,
  })
  const clients = clientsData?.data ?? []

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', selectedTenantId, filterClientId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterClientId) params.set('client_id', filterClientId)
      const qs = params.toString()
      return authedFetch<DashboardData>(`/api/dashboard${qs ? '?' + qs : ''}`, { tenantScoped: true })
    },
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  return (
    <Card>
      <PageHeader
        title="Dashboard"
        action={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        }
      />

      {isError && (
        <div className="rounded-md border border-red-700 bg-red-950/60 p-3 text-sm text-red-300">
          {(error as { message?: string })?.message ?? 'Failed to load dashboard data.'}
        </div>
      )}

      {/* ── Renewals row ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Critical Renewals */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Critical Renewals</h3>
          <div className="mt-2 space-y-2">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.critical_renewals.length === 0 ? (
              <EmptyState message="No critical renewals." />
            ) : (
              data.critical_renewals.map((r) => (
                <RenewalRow
                  key={r.id}
                  r={r}
                  onClick={() => onOpenRenewal(r)}
                  tenantTimezone={tenantTimezone}
                />
              ))
            )}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ui-text)]">Upcoming Renewals</h3>
          </div>
          <div className="mt-2 mb-2">
            <Select
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.upcoming_renewals.length === 0 ? (
              <EmptyState message="No upcoming renewals." />
            ) : (
              data.upcoming_renewals.map((r) => (
                <RenewalRow
                  key={r.id}
                  r={r}
                  onClick={() => onOpenRenewal(r)}
                  tenantTimezone={tenantTimezone}
                />
              ))
            )}
          </div>
        </div>

        {/* Upcoming SLA Renewals */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Upcoming SLA Renewals</h3>
          <div className="mt-2 space-y-2">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.upcoming_sla_allocations.length === 0 ? (
              <EmptyState message="No upcoming SLA renewals." />
            ) : (
              data.upcoming_sla_allocations.map((a: SlaAllocation) => (
                <div key={a.id} className="app-inner-box rounded-md border border-[var(--ui-border)] p-2">
                  <p className="font-medium text-sm text-[var(--ui-text)]">{a.sla_item?.name ?? `SLA #${a.sla_item_id}`}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {a.client && (
                      <span className="text-xs text-[var(--ui-muted)]">
                        Client: <span className="text-[var(--ui-text)]">{a.client.name}</span>
                      </span>
                    )}
                    {a.department && (
                      <span className="text-xs text-[var(--ui-muted)]">
                        Dept: <span className="text-[var(--ui-text)]">{a.department.name}</span>
                      </span>
                    )}
                    {a.renewal_date && (
                      <span className="text-xs text-[var(--ui-muted)]">
                        Renews: <span className="text-[var(--ui-text)]">{formatDate(a.renewal_date, tenantTimezone)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Inventory row ─────────────────────────────────────────────────── */}
      <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
        <h3 className="mb-2 font-semibold text-[var(--ui-text)]">Low Stock</h3>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
          </div>
        ) : !data || data.low_stock_items.length === 0 ? (
          <EmptyState message="No low stock items." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {data.low_stock_items.map((item) => (
              <button
                key={item.id}
                className={itemButtonClass}
                onClick={() => onOpenInventory(item)}
              >
                <p className="font-medium text-sm text-[var(--ui-text)]">{item.name}</p>
                <p className="text-xs text-[var(--ui-muted)]">
                  On hand: {item.quantity_on_hand} / Min: {item.minimum_on_hand}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

export function DashboardPage({ onOpenRenewal, onOpenInventory }: DashboardPageProps) {
  return (
    <ErrorBoundary>
      <DashboardContent onOpenRenewal={onOpenRenewal} onOpenInventory={onOpenInventory} />
    </ErrorBoundary>
  )
}
