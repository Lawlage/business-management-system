import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import type { RecycleBinData } from '../../types'

type Tab = 'renewals' | 'inventory'

export function RecycleBinPage() {
  const { selectedTenantId } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('renewals')

  const { data, isLoading } = useQuery({
    queryKey: ['recycle-bin', selectedTenantId],
    queryFn: () =>
      authedFetch<RecycleBinData>('/api/recycle-bin', { tenantScoped: true }),
    enabled: !!selectedTenantId,
  })

  const restoreMutation = useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: number }) =>
      authedFetch(`/api/recycle-bin/${entityType}/${id}/restore`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Record restored.')
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['renewals', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleRestore = (entityType: string, id: number) => {
    restoreMutation.mutate({ entityType, id })
  }

  const tabClass = (tab: Tab) =>
    [
      'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
      activeTab === tab
        ? 'border-[var(--ui-tertiary)] text-[var(--ui-text)]'
        : 'border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
    ].join(' ')

  return (
    <Card>
      <PageHeader title="Recycle Bin" />

      {/* Tab bar */}
      <div className="mb-4 flex border-b border-[var(--ui-border)]">
        <button className={tabClass('renewals')} onClick={() => setActiveTab('renewals')}>
          Renewals
        </button>
        <button className={tabClass('inventory')} onClick={() => setActiveTab('inventory')}>
          Inventory Items
        </button>
      </div>

      {/* Renewals tab */}
      {activeTab === 'renewals' && (
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !data || data.renewals.data.length === 0 ? (
            <EmptyState message="No renewals in the recycle bin." />
          ) : (
            data.renewals.data.map((renewal) => (
              <div
                key={renewal.id}
                className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] p-2"
              >
                <span className="text-sm text-[var(--ui-muted)]">{renewal.title}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={restoreMutation.isPending}
                  onClick={() => handleRestore('renewal', renewal.id)}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Inventory tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !data || data.inventory_items.data.length === 0 ? (
            <EmptyState message="No inventory items in the recycle bin." />
          ) : (
            data.inventory_items.data.map((item) => (
              <div
                key={item.id}
                className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] p-2"
              >
                <span className="text-sm text-[var(--ui-muted)]">{item.name}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={restoreMutation.isPending}
                  onClick={() => handleRestore('inventory', item.id)}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  )
}
