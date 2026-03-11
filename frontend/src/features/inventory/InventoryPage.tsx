import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { formatDateTime } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { CreateInventoryModal } from './CreateInventoryModal'
import type { InventoryItem, PaginatedResponse } from '../../types'

type InventoryPageProps = {
  onOpenItem: (item: InventoryItem) => void
}

function InventoryContent({ onOpenItem }: InventoryPageProps) {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [adjustQtys, setAdjustQtys] = useState<Record<number, number>>({})

  const canCreate = role !== 'standard_user'

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['inventory', selectedTenantId, page],
    queryFn: () =>
      authedFetch<PaginatedResponse<InventoryItem>>(`/api/inventory?page=${page}`, {
        tenantScoped: true,
      }),
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

  const adjustMutation = useMutation({
    mutationFn: ({
      id,
      type,
      quantity,
    }: {
      id: number
      type: 'check_in' | 'check_out'
      quantity: number
    }) =>
      authedFetch(`/api/inventory/${id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ type, quantity, reason: '' }),
        tenantScoped: true,
      }),
    onSuccess: (_, variables) => {
      showNotice('Stock updated.')
      setAdjustQtys((prev) => ({ ...prev, [variables.id]: 0 }))
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', selectedTenantId] })
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleAdjust = (item: InventoryItem, type: 'check_in' | 'check_out') => {
    const qty = adjustQtys[item.id] ?? 0
    if (qty <= 0) return
    adjustMutation.mutate({ id: item.id, type, quantity: qty })
  }

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Inventory"
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create Item
            </Button>
          ) : undefined
        }
      />

      {/* Table header — hidden on mobile */}
      {allItems.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[minmax(0,2fr)_110px_110px_220px_280px] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Item</span>
          <span>On Hand</span>
          <span>Minimum</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
        ) : allItems.length === 0 ? (
          <EmptyState
            message="No inventory items found. Create your first item to get started."
            action={
              canCreate ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          allItems.map((item) => (
            <div
              key={item.id}
              className="app-inner-box rounded-md border border-[var(--ui-border)] p-3"
            >
              <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_110px_110px_220px_280px] items-center">
                {/* Item name + SKU — clickable */}
                <button
                  className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60 rounded"
                  onClick={() => onOpenItem(item)}
                >
                  <p className="font-medium text-sm text-[var(--ui-text)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--ui-muted)]">{item.sku}</p>
                </button>

                <span className="text-sm text-[var(--ui-text)]">{item.quantity_on_hand}</span>

                <span className="text-sm text-[var(--ui-muted)]">{item.minimum_on_hand}</span>

                <span className="text-xs text-[var(--ui-muted)]">
                  {formatDateTime(item.created_at, tenantTimezone)}
                </span>

                {/* Stock adjustment */}
                <div className="flex items-center gap-2 justify-end">
                  <input
                    type="number"
                    min={0}
                    value={adjustQtys[item.id] ?? 0}
                    onChange={(e) =>
                      setAdjustQtys((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-16 rounded-md border border-[var(--ui-border)] px-2 py-1.5 text-sm app-panel"
                    aria-label="Adjustment quantity"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-12 justify-center"
                    onClick={() => handleAdjust(item, 'check_out')}
                    disabled={adjustMutation.isPending}
                  >
                    Out
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-12 justify-center"
                    onClick={() => handleAdjust(item, 'check_in')}
                    disabled={adjustMutation.isPending}
                  >
                    In
                  </Button>
                </div>
              </div>
            </div>
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
        <CreateInventoryModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Card>
  )
}

export function InventoryPage({ onOpenItem }: InventoryPageProps) {
  return (
    <ErrorBoundary>
      <InventoryContent onOpenItem={onOpenItem} />
    </ErrorBoundary>
  )
}
