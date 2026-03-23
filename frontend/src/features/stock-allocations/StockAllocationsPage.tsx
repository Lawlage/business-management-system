import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import type { StockAllocation, PaginatedResponse } from '../../types'

function StockAllocationsContent() {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allAllocations, setAllAllocations] = useState<StockAllocation[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const canAllocate = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'

  // Reset on tenant switch or filter change
  useEffect(() => {
    setPage(1)
    setAllAllocations([])
  }, [selectedTenantId, statusFilter])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['stock-allocations', selectedTenantId, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter) params.set('status', statusFilter)
      return authedFetch<PaginatedResponse<StockAllocation>>(
        `/api/stock-allocations?${params.toString()}`,
        { tenantScoped: true },
      )
    },
    enabled: !!selectedTenantId,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllAllocations(data.data)
    } else {
      setAllAllocations((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      authedFetch(`/api/stock-allocations/${id}/cancel`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Allocation cancelled.')
      void queryClient.invalidateQueries({ queryKey: ['stock-allocations', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
      setPage(1)
      setAllAllocations([])
    },
    onError: (error: unknown) => {
      showNotice((error as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const handleCancel = async (allocation: StockAllocation) => {
    const confirmed = await confirm({
      title: 'Cancel allocation?',
      message: `This will return ${allocation.quantity} unit(s) of "${allocation.inventory_item?.name}" to stock.`,
      confirmLabel: 'Cancel Allocation',
      variant: 'danger',
    })
    if (confirmed) cancelMutation.mutate(allocation.id)
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

  const sortedAllocations = useMemo(() => {
    if (!sortField) return allAllocations
    return [...allAllocations].sort((a, b) => {
      let aVal: string | number | null | undefined
      let bVal: string | number | null | undefined
      if (sortField === 'item') { aVal = a.inventory_item?.name; bVal = b.inventory_item?.name }
      else if (sortField === 'client') { aVal = a.client?.name; bVal = b.client?.name }
      else if (sortField === 'quantity') { aVal = a.quantity; bVal = b.quantity }
      else if (sortField === 'unit_price') { aVal = a.unit_price ? parseFloat(a.unit_price) : null; bVal = b.unit_price ? parseFloat(b.unit_price) : null }
      else if (sortField === 'total') {
        aVal = a.unit_price ? a.quantity * parseFloat(a.unit_price) : null
        bVal = b.unit_price ? b.quantity * parseFloat(b.unit_price) : null
      }
      else if (sortField === 'date') { aVal = a.created_at; bVal = b.created_at }
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
  }, [allAllocations, sortField, sortDir])

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader title="Stock Allocations" />

      <div className="mb-4 flex gap-2">
        {(['', 'allocated', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition',
              statusFilter === s
                ? 'bg-[var(--ui-button-bg)] text-white'
                : 'bg-[var(--ui-inner-bg)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
            ].join(' ')}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {allAllocations.length > 0 && (
        <div className="sticky-list-header mb-2 hidden md:grid md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          {([['item','Item'],['client','Client'],['quantity','Qty'],['unit_price','Unit Price'],['total','Total'],['date','Date']] as const).map(([field, label]) => (
            <button key={field} onClick={() => handleSort(field)} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 -mx-1.5 rounded hover:text-[var(--ui-text)] transition group">
              {label}<SortIcon field={field} />
            </button>
          ))}
          <span />
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
        ) : allAllocations.length === 0 ? (
          <EmptyState message="No stock allocations found." />
        ) : (
          sortedAllocations.map((a) => (
            <div
              key={a.id}
              className="app-inner-box grid items-center gap-3 rounded-md border border-[var(--ui-border)] p-3 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_80px]"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ui-text)] truncate">
                  {a.inventory_item?.name ?? '—'}
                </p>
                <p className="text-xs text-[var(--ui-muted)]">{a.inventory_item?.sku ?? ''}</p>
              </div>
              <span className="text-sm text-[var(--ui-text)] truncate">{a.client?.name ?? '—'}</span>
              <span className="text-sm text-[var(--ui-text)]">{a.quantity}</span>
              <span className="text-sm text-[var(--ui-muted)]">
                {a.unit_price ? `$${a.unit_price}` : '—'}
              </span>
              <span className="text-sm text-[var(--ui-muted)]">
                {a.unit_price ? `$${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : '—'}
              </span>
              <span className="text-xs text-[var(--ui-muted)]">
                {formatDate(a.created_at, tenantTimezone)}
              </span>
              <div className="flex items-center justify-end gap-2">
                <Badge status={a.status} />
                {a.status === 'allocated' && canAllocate && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleCancel(a)}
                    isLoading={cancelMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!isFirstLoad && allAllocations.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}
    </Card>
  )
}

export function StockAllocationsPage() {
  return (
    <ErrorBoundary>
      <StockAllocationsContent />
    </ErrorBoundary>
  )
}
