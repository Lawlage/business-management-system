import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { useTenant } from '../../contexts/TenantContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { CreateSlaItemModal } from './CreateSlaItemModal'
import { SlaItemDetailModal } from './SlaItemDetailModal'
import type { SlaItem, PaginatedResponse } from '../../types'

function SlaItemsContent() {
  const { selectedTenantId, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<SlaItem[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SlaItem | null>(null)

  const canCreate = role !== 'standard_user'

  // Reset on tenant switch
  const [prevTenantId, setPrevTenantId] = useState(selectedTenantId)
  if (selectedTenantId !== prevTenantId) {
    setPrevTenantId(selectedTenantId)
    setPage(1)
    setAllItems([])
  }

  // Reset pagination on search change
  const [prevSearch, setPrevSearch] = useState(debouncedSearch)
  if (debouncedSearch !== prevSearch) {
    setPrevSearch(debouncedSearch)
    setPage(1)
    setAllItems([])
  }

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['sla-items', selectedTenantId, debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      return authedFetch<PaginatedResponse<SlaItem>>(`/api/sla-items?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
  })

  // Accumulate paginated data
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    if (data) {
      if (page === 1) {
        setAllItems(data.data)
      } else {
        setAllItems((prev) => [...prev, ...data.data])
      }
    }
  }

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['sla-items', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ['sla-items', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="SLA Items"
        description="Define SLA tiers and allocate service agreements to clients."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create SLA Item
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search SLA items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 p-3 text-sm text-red-300">
          {(error as { message?: string })?.message ?? 'Failed to load data.'}
        </div>
      )}

      {allItems.length > 0 && (
        <div className="sticky-list-header mb-2 hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Name</span>
          <span>SKU</span>
          <span>Tier</span>
          <span>Cost</span>
          <span>Sale</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
        ) : allItems.length === 0 ? (
          <EmptyState
            message={debouncedSearch ? 'No SLA items match your search.' : 'No SLA items found. Create your first SLA item to get started.'}
            action={
              canCreate && !debouncedSearch ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create SLA Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          allItems.map((item) => (
            <button
              key={item.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => setSelectedItem(item)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{item.name}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{item.sku}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{item.tier ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)]">${item.cost_price}</span>
                <span className="text-sm text-[var(--ui-muted)]">${item.sale_price}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {!isFirstLoad && allItems.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateSlaItemModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedItem && (
        <SlaItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={handleUpdated}
          canEdit={canCreate}
          canDelete={role === 'tenant_admin' || role === 'global_superadmin'}
        />
      )}
    </Card>
  )
}

export function SlaItemsPage() {
  return (
    <ErrorBoundary>
      <SlaItemsContent />
    </ErrorBoundary>
  )
}
