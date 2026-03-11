import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { formatDateTime, formatRenewalCategory } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { CreateRenewalModal } from './CreateRenewalModal'
import type { Renewal, PaginatedResponse } from '../../types'

type RenewalsPageProps = {
  onOpenRenewal: (renewal: Renewal) => void
}

function RenewalsContent({ onOpenRenewal }: RenewalsPageProps) {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allRenewals, setAllRenewals] = useState<Renewal[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const canCreate = role !== 'standard_user'

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['renewals', selectedTenantId, page],
    queryFn: () =>
      authedFetch<PaginatedResponse<Renewal>>(`/api/renewals?page=${page}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllRenewals(data.data)
    } else {
      setAllRenewals((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewals', selectedTenantId] })
    setPage(1)
    setAllRenewals([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Renewals"
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create Renewal
            </Button>
          ) : undefined
        }
      />

      {/* Table header — hidden on mobile */}
      {allRenewals.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1.3fr_1.2fr_0.8fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Title</span>
          <span>Type / Status</span>
          <span>Workflow</span>
          <span>Auto</span>
          <span>Expires</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
        ) : allRenewals.length === 0 ? (
          <EmptyState
            message="No renewals found. Create your first renewal to get started."
            action={
              canCreate ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create Renewal
                </Button>
              ) : undefined
            }
          />
        ) : (
          allRenewals.map((renewal) => (
            <button
              key={renewal.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => onOpenRenewal(renewal)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1.3fr_1.2fr_0.8fr_1fr]">
                <span className="font-medium text-sm text-[var(--ui-text)]">{renewal.title}</span>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--ui-muted)]">
                    {formatRenewalCategory(renewal.category)}
                  </span>
                  <Badge status={renewal.status} />
                </div>

                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {renewal.workflow_status ?? '—'}
                </span>

                <span className="text-sm text-[var(--ui-muted)]">
                  {renewal.auto_renews ? 'Yes' : 'No'}
                </span>

                <span className="text-sm text-[var(--ui-muted)]">
                  {formatDateTime(renewal.expiration_date, tenantTimezone)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {!isFirstLoad && allRenewals.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateRenewalModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Card>
  )
}

export function RenewalsPage({ onOpenRenewal }: RenewalsPageProps) {
  return (
    <ErrorBoundary>
      <RenewalsContent onOpenRenewal={onOpenRenewal} />
    </ErrorBoundary>
  )
}
