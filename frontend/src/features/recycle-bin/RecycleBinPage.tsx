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

export function RecycleBinPage() {
  const { selectedTenantId } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const queryClient = useQueryClient()

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

  return (
    <Card>
      <PageHeader title="Recycle Bin" />

      {/* Renewals Section */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">Renewals</h3>

        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !data || data.renewals.length === 0 ? (
            <EmptyState message="Your recycle bin is empty." />
          ) : (
            data.renewals.map((renewal) => (
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
      </div>

      {/* Inventory Items Section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">Inventory Items</h3>

        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : !data || data.inventory_items.length === 0 ? (
            <EmptyState message="Your recycle bin is empty." />
          ) : (
            data.inventory_items.map((item) => (
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
      </div>
    </Card>
  )
}
