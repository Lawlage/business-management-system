import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import type { RecycleBinData } from '../../types'

type Tab = 'renewals' | 'inventory' | 'custom_fields'

export function RecycleBinPage() {
  const { selectedTenantId } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('renewals')

  const { data, isLoading } = useQuery({
    queryKey: ['recycle-bin', selectedTenantId],
    queryFn: () =>
      authedFetch<RecycleBinData>('/api/recycle-bin', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  const restoreMutation = useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: number }) =>
      authedFetch(`/api/recycle-bin/${entityType}/${id}/restore`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: (_, { entityType }) => {
      showNotice('Record restored.')
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['renewals', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
      if (entityType === 'custom_field') {
        void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
      }
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

  const forceDeleteMutation = useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: number }) =>
      authedFetch(`/api/recycle-bin/${entityType}/${id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Record permanently deleted.')
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin', selectedTenantId] })
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleForceDelete = async (entityType: string, id: number) => {
    const confirmed = await confirm({
      title: 'Permanently delete?',
      message: 'This cannot be undone. The record will be gone forever.',
      confirmLabel: 'Delete Forever',
      variant: 'danger',
    })
    if (confirmed) {
      forceDeleteMutation.mutate({ entityType, id })
    }
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
        <button className={tabClass('custom_fields')} onClick={() => setActiveTab('custom_fields')}>
          Custom Fields
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
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={restoreMutation.isPending}
                    onClick={() => handleRestore('renewal', renewal.id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={forceDeleteMutation.isPending}
                    onClick={() => void handleForceDelete('renewal', renewal.id)}
                  >
                    Delete Forever
                  </Button>
                </div>
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
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={restoreMutation.isPending}
                    onClick={() => handleRestore('inventory', item.id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={forceDeleteMutation.isPending}
                    onClick={() => void handleForceDelete('inventory', item.id)}
                  >
                    Delete Forever
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Custom Fields tab */}
      {activeTab === 'custom_fields' && (
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !data || data.custom_fields.data.length === 0 ? (
            <EmptyState message="No custom fields in the recycle bin." />
          ) : (
            data.custom_fields.data.map((field) => (
              <div
                key={field.id}
                className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] p-2"
              >
                <div>
                  <span className="text-sm text-[var(--ui-muted)]">{field.name}</span>
                  <span className="ml-2 text-xs text-[var(--ui-muted)] opacity-60">
                    ({field.entity_type} — {field.field_type})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={restoreMutation.isPending}
                    onClick={() => handleRestore('custom_field', field.id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={forceDeleteMutation.isPending}
                    onClick={() => void handleForceDelete('custom_field', field.id)}
                  >
                    Delete Forever
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  )
}
