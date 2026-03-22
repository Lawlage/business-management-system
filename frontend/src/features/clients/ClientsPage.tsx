import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Input } from '../../components/Input'
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
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const canCreate = role !== 'standard_user'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset on tenant switch
  useEffect(() => {
    setSearch('')
    setDebouncedSearch('')
    setPage(1)
    setAllClients([])
  }, [selectedTenantId])

  // Reset pagination on search change
  useEffect(() => {
    setPage(1)
    setAllClients([])
  }, [debouncedSearch])

  const { data, isLoading, isFetching } = useQuery({
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

      {/* Table header -- hidden on mobile */}
      {allClients.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1.5fr_1.5fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Name</span>
          <span>Contact Name</span>
          <span>Email</span>
          <span>Phone</span>
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
          allClients.map((client) => (
            <button
              key={client.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => navigate(`/app/clients/${client.id}`)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.5fr_1fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{client.name}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.contact_name ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.email ?? '—'}</span>
                <span className="text-sm text-[var(--ui-muted)] truncate">{client.phone ?? '—'}</span>
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
