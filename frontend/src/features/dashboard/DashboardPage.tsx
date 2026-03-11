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
import { formatDateTime } from '../../lib/format'
import type { DashboardData, Renewal, InventoryItem } from '../../types'

type DashboardPageProps = {
  onOpenRenewal: (renewal: Renewal) => void
  onOpenInventory: (item: InventoryItem) => void
}

const itemButtonClass =
  'app-inner-box w-full cursor-pointer rounded-md border border-[var(--ui-border)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--ui-accent)]/80 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/80'

function DashboardContent({ onOpenRenewal, onOpenInventory }: DashboardPageProps) {
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { authedFetch } = useApi()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', selectedTenantId],
    queryFn: () => authedFetch<DashboardData>('/api/dashboard', { tenantScoped: true }),
    enabled: !!selectedTenantId,
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
                <button
                  key={r.id}
                  className={itemButtonClass}
                  onClick={() => onOpenRenewal(r)}
                >
                  <p className="font-medium text-sm text-[var(--ui-text)]">{r.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge status={r.status} />
                    <span className="text-xs text-[var(--ui-muted)]">
                      {formatDateTime(r.expiration_date, tenantTimezone)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Most Important Renewals */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Important Renewals</h3>
          <div className="mt-2 space-y-2">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.important_renewals.length === 0 ? (
              <EmptyState message="No upcoming renewals." />
            ) : (
              data.important_renewals.map((r) => (
                <button
                  key={r.id}
                  className={itemButtonClass}
                  onClick={() => onOpenRenewal(r)}
                >
                  <p className="font-medium text-sm text-[var(--ui-text)]">{r.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge status={r.status} />
                    <span className="text-xs text-[var(--ui-muted)]">
                      {formatDateTime(r.expiration_date, tenantTimezone)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
          <h3 className="font-semibold text-[var(--ui-text)]">Low Stock</h3>
          <div className="mt-2 space-y-2">
            {isLoading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : !data || data.low_stock_items.length === 0 ? (
              <EmptyState message="No low stock items." />
            ) : (
              data.low_stock_items.map((item) => (
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
              ))
            )}
          </div>
        </div>
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
