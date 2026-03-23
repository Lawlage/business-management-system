import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Input } from '../../components/Input'
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
  const [adjustQtys, setAdjustQtys] = useState<Record<number, string | number>>({})
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const canCreate = role !== 'standard_user'

  // Reset on tenant switch
  useEffect(() => {
    setSearch('')
    setPage(1)
    setAllItems([])
  }, [selectedTenantId])

  // Reset pagination on search change
  useEffect(() => {
    setPage(1)
    setAllItems([])
  }, [debouncedSearch])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['inventory', selectedTenantId, debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      return authedFetch<PaginatedResponse<InventoryItem>>(`/api/inventory?${params.toString()}`, {
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
      setAdjustQtys((prev) => ({ ...prev, [variables.id]: '' }))
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
    const raw = adjustQtys[item.id]
    const qty = raw === '' || raw === undefined ? 1 : Math.max(1, Number(raw))
    adjustMutation.mutate({ id: item.id, type, quantity: qty })
  }

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
    ) : (
      <ChevronsUpDown size={10} className="opacity-30 group-hover:opacity-60" />
    )

  const sortedItems = useMemo(() => {
    if (!sortField) return allItems
    return [...allItems].sort((a, b) => {
      let aVal: string | number | null | undefined
      let bVal: string | number | null | undefined
      if (sortField === 'name') { aVal = a.name; bVal = b.name }
      else if (sortField === 'quantity_on_hand') { aVal = a.quantity_on_hand; bVal = b.quantity_on_hand }
      else if (sortField === 'minimum_on_hand') { aVal = a.minimum_on_hand; bVal = b.minimum_on_hand }
      else if (sortField === 'created_at') { aVal = a.created_at; bVal = b.created_at }
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
  }, [allItems, sortField, sortDir])

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Inventory"
        description="Monitor stock levels, adjust quantities, and manage inventory items across locations."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create Item
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search inventory..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 p-3 text-sm text-red-300">
          {(error as { message?: string })?.message ?? 'Failed to load data.'}
        </div>
      )}

      {/* Table header -- hidden on mobile */}
      {allItems.length > 0 && (
        <div className="mb-2 hidden md:flex md:items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <div className="flex-1 grid grid-cols-[minmax(0,2fr)_110px_110px_220px] gap-3">
            {([['name','Item'],['quantity_on_hand','On Hand'],['minimum_on_hand','Minimum'],['created_at','Created']] as const).map(([field, label]) => (
              <button key={field} onClick={() => handleSort(field)} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 -mx-1.5 rounded hover:text-[var(--ui-text)] transition group">
                {label}<SortIcon field={field} />
              </button>
            ))}
          </div>
          <div className="w-[220px] shrink-0 text-right pr-1">Adjust Stock</div>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
        ) : allItems.length === 0 ? (
          <EmptyState
            message={debouncedSearch ? 'No inventory items match your search.' : 'No inventory items found. Create your first item to get started.'}
            action={
              canCreate && !debouncedSearch ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          sortedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              {/* Clickable row */}
              <button
                className="app-inner-box flex-1 rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
                onClick={() => onOpenItem(item)}
              >
                <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_110px_110px_220px] items-center">
                  <div>
                    <p className="font-medium text-sm text-[var(--ui-text)] truncate">{item.name}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{item.sku}</p>
                  </div>
                  <span className="text-sm text-[var(--ui-text)]">{item.quantity_on_hand}</span>
                  <span className="text-sm text-[var(--ui-muted)]">{item.minimum_on_hand}</span>
                  <span className="text-xs text-[var(--ui-muted)]">
                    {formatDate(item.created_at, tenantTimezone)}
                  </span>
                </div>
              </button>

              {/* Stock adjustment — outside the clickable box */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  value={adjustQtys[item.id] ?? 1}
                  onChange={(e) =>
                    setAdjustQtys((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  onFocus={(e) => e.target.select()}
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
