import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { useTenant } from '../../contexts/TenantContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatRenewalCategory, formatFrequency } from '../../lib/format'
import { CreateProductModal } from './CreateProductModal'
import { ProductDetailModal } from './ProductDetailModal'
import type { Product, Department, PaginatedResponse } from '../../types'
import { renewableCategoryOptions } from '../../types'

function ProductsContent() {
  const { selectedTenantId, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allItems, setAllItems] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterVendor, setFilterVendor] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)

  const canCreate = role !== 'standard_user'

  // Reset on tenant switch
  const [prevTenantId, setPrevTenantId] = useState(selectedTenantId)
  if (selectedTenantId !== prevTenantId) {
    setPrevTenantId(selectedTenantId)
    setPage(1)
    setAllItems([])
    setSearch('')
    setFilterCategory('')
    setFilterVendor('')
    setFilterDepartmentId('')
  }

  // Reset pagination on filter change
  const filterKey = `${debouncedSearch}|${filterCategory}|${filterVendor}|${filterDepartmentId}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
    setAllItems([])
  }

  const hasActiveFilters = !!(debouncedSearch || filterCategory || filterVendor || filterDepartmentId)

  const clearFilters = () => {
    setSearch('')
    setFilterCategory('')
    setFilterVendor('')
    setFilterDepartmentId('')
  }

  const { data: vendorList } = useQuery({
    queryKey: ['product-vendors', selectedTenantId],
    queryFn: () => authedFetch<string[]>('/api/products/vendors', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data: departmentList } = useQuery({
    queryKey: ['departments-all', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['products', selectedTenantId, debouncedSearch, filterCategory, filterVendor, filterDepartmentId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterCategory) params.set('category', filterCategory)
      if (filterVendor) params.set('vendor', filterVendor)
      if (filterDepartmentId) params.set('department_id', filterDepartmentId)
      return authedFetch<PaginatedResponse<Product>>(`/api/products?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
  })

  // Accumulate paginated data
  const [prevData, setPrevData] = useState<typeof data>()
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
    void queryClient.invalidateQueries({ queryKey: ['products', selectedTenantId] })
    void queryClient.invalidateQueries({ queryKey: ['product-vendors', selectedTenantId] })
    setPage(1)
    setAllItems([])
  }

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ['products', selectedTenantId] })
    void queryClient.invalidateQueries({ queryKey: ['product-vendors', selectedTenantId] })
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
      else if (sortField === 'category') { aVal = a.category; bVal = b.category }
      else if (sortField === 'vendor') { aVal = a.vendor; bVal = b.vendor }
      else if (sortField === 'department') { aVal = a.department?.name; bVal = b.department?.name }
      else if (sortField === 'cost_price') { aVal = a.cost_price ? parseFloat(a.cost_price) : null; bVal = b.cost_price ? parseFloat(b.cost_price) : null }
      else if (sortField === 'sale_price') { aVal = a.sale_price ? parseFloat(a.sale_price) : null; bVal = b.sale_price ? parseFloat(b.sale_price) : null }
      else if (sortField === 'frequency') { aVal = a.frequency_value ?? null; bVal = b.frequency_value ?? null }
      else if (sortField === 'count') { aVal = a.renewables_count ?? 0; bVal = b.renewables_count ?? 0 }
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
        title="Products"
        description="Manage your product catalogue — define items, pricing, and default renewal durations."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + New Product
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3">
        <Input
          placeholder="Search by name or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div className="min-w-[9rem]">
          <Select label="Category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All</option>
            {renewableCategoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[9rem] max-w-[200px]">
          <Select label="Vendor" value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)}>
            <option value="">All</option>
            {(vendorList ?? []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[9rem] max-w-[200px]">
          <Select label="Department" value={filterDepartmentId} onChange={(e) => setFilterDepartmentId(e.target.value)}>
            <option value="">All</option>
            {(departmentList ?? []).map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </Select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          Clear filters
        </Button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 p-3 text-sm text-red-300">
          {(error as { message?: string })?.message ?? 'Failed to load data.'}
        </div>
      )}

      {allItems.length > 0 && (
        <div className="sticky-list-header mb-2 hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_0.6fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          {([['name','Name'],['category','Category'],['vendor','Vendor'],['department','Department'],['cost_price','Cost Price'],['sale_price','Sale Price'],['frequency','Default Duration'],['count','# Applied']] as const).map(([field, label]) => (
            <button key={field} onClick={() => handleSort(field)} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 -mx-1.5 rounded hover:text-[var(--ui-text)] transition group">
              {label}<SortIcon field={field} />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
        ) : allItems.length === 0 ? (
          <EmptyState
            message={hasActiveFilters ? 'No products match your filters.' : 'No products found. Create your first product to get started.'}
            action={
              canCreate && !hasActiveFilters ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  New Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          sortedItems.map((item) => (
            <button
              key={item.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => setSelectedItem(item)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr_0.6fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{item.name}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{formatRenewalCategory(item.category)}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{item.vendor ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{item.department?.name ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)]">{item.cost_price ? `$${item.cost_price}` : '—'}</span>
                <span className="text-sm text-[var(--ui-muted)]">{item.sale_price ? `$${item.sale_price}` : '—'}</span>
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
        <CreateProductModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedItem && (
        <ProductDetailModal
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

export function ProductsPage() {
  return (
    <ErrorBoundary>
      <ProductsContent />
    </ErrorBoundary>
  )
}
