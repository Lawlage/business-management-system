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
import { SearchCombobox } from '../../components/SearchCombobox'
import { formatDate } from '../../lib/format'
import type { DashboardData, Renewable, InventoryItem, Client, PaginatedResponse } from '../../types'

type DashboardPageProps = {
  onOpenRenewal: (renewable: Renewable) => void
  onOpenInventory: (item: InventoryItem) => void
}

const itemButtonClass =
  'app-inner-box w-full cursor-pointer rounded-md border border-[var(--ui-border)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--ui-accent)]/80 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/80'

function RenewalRow({ r, onClick, tenantTimezone }: { r: Renewable; onClick: () => void; tenantTimezone: string }) {
  return (
    <button className={itemButtonClass} onClick={onClick}>
      <p className="font-medium text-sm text-[var(--ui-text)]">
        {r.description ?? r.renewable_product?.name ?? `Renewable #${r.id}`}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge status={r.status ?? ''} />
        <span className="text-xs text-[var(--ui-muted)]">
          {formatDate(r.next_due_date, tenantTimezone)}
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
    queryFn: () => authedFetch<PaginatedResponse<Client>>('/api/clients?per_page=500', { tenantScoped: true }),
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
        description="An overview of upcoming client services, critical items, and low stock alerts."
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

      {/* ── Client filter ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--ui-muted)] whitespace-nowrap">Filter by client:</span>
        <div className="w-56">
          <SearchCombobox
            placeholder="All clients…"
            options={clients.map((c) => ({ id: c.id, label: c.name }))}
            value={filterClientId ? { id: Number(filterClientId), label: clients.find((c) => String(c.id) === filterClientId)?.name ?? '' } : null}
            onChange={(opt) => setFilterClientId(String(opt.id))}
            onClear={() => setFilterClientId('')}
          />
        </div>
      </div>

      {/* ── Client Services row ───────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Critical Client Services */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Critical Client Services</h3>
          <div className="mt-2 space-y-3">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.critical_renewals.length === 0 ? (
              <EmptyState message="No critical client services." />
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

        {/* Upcoming Client Services */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Upcoming Client Services</h3>
          <div className="mt-2 space-y-3">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.upcoming_renewals.length === 0 ? (
              <EmptyState message="No upcoming client services." />
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
      </div>

      {/* ── Inventory row ─────────────────────────────────────────────────── */}
      <div className="mt-4 app-inner-box rounded-md border border-[var(--ui-border)] p-3">
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
