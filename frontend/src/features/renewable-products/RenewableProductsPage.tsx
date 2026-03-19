import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { formatRenewalCategory, formatFrequency } from '../../lib/format'
import { CreateRenewableProductModal } from './CreateRenewableProductModal'
import { RenewableProductDetailModal } from './RenewableProductDetailModal'
import type { RenewableProduct, PaginatedResponse } from '../../types'

function RenewableProductsContent() {
  const { selectedTenantId, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<RenewableProduct[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RenewableProduct | null>(null)

  const canCreate = role !== 'standard_user'

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
    setAllItems([])
  }, [selectedTenantId])

  useEffect(() => {
    setPage(1)
    setAllItems([])
  }, [debouncedSearch])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['renewable-products', selectedTenantId, debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      return authedFetch<PaginatedResponse<RenewableProduct>>(`/api/renewable-products?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllItems(data.data)
    } else {
      setAllItems((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewable-products', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewable-products', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Renewable Products"
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + New Renewable Product
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search by name or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {allItems.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_0.6fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Name</span>
          <span>Category</span>
          <span>Vendor</span>
          <span>Cost Price</span>
          <span>Default Duration</span>
          <span># Applied</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
        ) : allItems.length === 0 ? (
          <EmptyState
            message={debouncedSearch ? 'No renewable products match your search.' : 'No renewable products found. Create your first product to get started.'}
            action={
              canCreate && !debouncedSearch ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  New Renewable Product
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
              <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_0.6fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{item.name}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{formatRenewalCategory(item.category)}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{item.vendor ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)]">${item.cost_price}</span>
                <span className="text-sm text-[var(--ui-muted)]">
                  {formatFrequency(item.frequency_type, item.frequency_value)}
                </span>
                <span className="text-sm text-[var(--ui-muted)]">{item.renewables_count ?? 0}</span>
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
        <CreateRenewableProductModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedItem && (
        <RenewableProductDetailModal
          product={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={handleUpdated}
          canEdit={canCreate}
          canDelete={role === 'tenant_admin' || role === 'global_superadmin'}
        />
      )}
    </Card>
  )
}

export function RenewableProductsPage() {
  return (
    <ErrorBoundary>
      <RenewableProductsContent />
    </ErrorBoundary>
  )
}
