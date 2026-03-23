import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { useTenant } from '../../contexts/TenantContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Input } from '../../components/Input'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { CreateClientModal } from './CreateClientModal'
import type { Client, PaginatedResponse } from '../../types'

function ClientsContent() {
  const navigate = useNavigate()
  const { selectedTenantId, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const canCreate = role !== 'standard_user'

  // Reset on tenant switch
  useEffect(() => {
    setSearch('')
    setPage(1)
    setAllClients([])
  }, [selectedTenantId])

  // Reset pagination on search change
  useEffect(() => {
    setPage(1)
    setAllClients([])
  }, [debouncedSearch])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['clients', selectedTenantId, debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      return authedFetch<PaginatedResponse<Client>>(`/api/clients?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllClients(data.data)
    } else {
      setAllClients((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['clients', selectedTenantId] })
    setPage(1)
    setAllClients([])
  }

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

  const sortedClients = useMemo(() => {
    if (!sortField) return allClients
    return [...allClients].sort((a, b) => {
      let aVal: string | null | undefined
      let bVal: string | null | undefined
      if (sortField === 'name') { aVal = a.name; bVal = b.name }
      else if (sortField === 'contact_name') { aVal = a.contact_name; bVal = b.contact_name }
      else if (sortField === 'email') { aVal = a.email; bVal = b.email }
      else if (sortField === 'phone') { aVal = a.phone; bVal = b.phone }
      else if (sortField === 'account_manager') {
        aVal = a.account_manager ? `${a.account_manager.last_name} ${a.account_manager.first_name}` : null
        bVal = b.account_manager ? `${b.account_manager.last_name} ${b.account_manager.first_name}` : null
      }
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [allClients, sortField, sortDir])

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Clients"
        description="Manage your client accounts, contacts, and assigned account managers."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create Client
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search clients..."
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
      {allClients.length > 0 && (
        <div className="sticky-list-header mb-2 hidden md:grid md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.5fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          {(['name', 'contact_name', 'email', 'phone', 'account_manager'] as const).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className="inline-flex items-center gap-0.5 py-0.5 px-1.5 -mx-1.5 rounded hover:text-[var(--ui-text)] transition group"
            >
              {field === 'name' ? 'Name' : field === 'contact_name' ? 'Contact Name' : field === 'email' ? 'Email' : field === 'phone' ? 'Phone' : 'Account Manager'}
              <SortIcon field={field} />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
        ) : allClients.length === 0 ? (
          <EmptyState
            message={debouncedSearch ? 'No clients match your search.' : 'No clients found. Create your first client to get started.'}
            action={
              canCreate && !debouncedSearch ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create Client
                </Button>
              ) : undefined
            }
          />
        ) : (
          sortedClients.map((client) => (
            <button
              key={client.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => navigate(`/app/clients/${client.id}`)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.5fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{client.name}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.contact_name ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.email ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.phone ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {client.account_manager
                    ? `${client.account_manager.first_name} ${client.account_manager.last_name}`
                    : '—'}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {!isFirstLoad && allClients.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateClientModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Card>
  )
}

export function ClientsPage() {
  return (
    <ErrorBoundary>
      <ClientsContent />
    </ErrorBoundary>
  )
}
