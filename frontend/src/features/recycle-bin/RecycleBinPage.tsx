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

type Tab = 'all' | 'client_services' | 'products' | 'inventory' | 'sla_items' | 'custom_fields' | 'clients'

type AllItem = {
  id: number
  label: string
  subLabel?: string
  entityType: string
  deleted_at: string
}

function buildAllItems(data: RecycleBinData): AllItem[] {
  const items: AllItem[] = [
    ...data.renewables.data.map((r) => ({
      id: r.id,
      label: r.description ?? `Client Service #${r.id}`,
      subLabel: 'Client Service',
      entityType: 'client_service',
      deleted_at: (r as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
    ...data.renewable_products.data.map((p) => ({
      id: p.id,
      label: p.name,
      subLabel: 'Product',
      entityType: 'product',
      deleted_at: (p as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
    ...data.inventory_items.data.map((i) => ({
      id: i.id,
      label: i.name,
      subLabel: 'Inventory',
      entityType: 'inventory',
      deleted_at: (i as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
    ...data.sla_items.data.map((s) => ({
      id: s.id,
      label: s.name,
      subLabel: 'SLA Item',
      entityType: 'sla_item',
      deleted_at: (s as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
    ...data.custom_fields.data.map((f) => ({
      id: f.id,
      label: f.name,
      subLabel: `Custom Field · ${f.field_type}`,
      entityType: 'custom_field',
      deleted_at: (f as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
    ...data.clients.data.map((c) => ({
      id: c.id,
      label: c.name,
      subLabel: 'Client',
      entityType: 'client',
      deleted_at: (c as unknown as { deleted_at?: string }).deleted_at ?? '',
    })),
  ]
  return items.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1))
}

function RecordRow({
  label,
  subLabel,
  onRestore,
  onForceDelete,
  isRestoring,
  isDeleting,
}: {
  label: string
  subLabel?: string
  onRestore: () => void
  onForceDelete: () => void
  isRestoring: boolean
  isDeleting: boolean
}) {
  return (
    <div className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] p-2">
      <div>
        <span className="text-sm text-[var(--ui-text)]">{label}</span>
        {subLabel && (
          <span className="ml-2 text-xs text-[var(--ui-muted)] opacity-60">{subLabel}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" isLoading={isRestoring} onClick={onRestore}>
          Restore
        </Button>
        <Button variant="danger" size="sm" isLoading={isDeleting} onClick={onForceDelete}>
          Delete Forever
        </Button>
      </div>
    </div>
  )
}

export function RecycleBinPage() {
  const { selectedTenantId } = useTenant()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('all')

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
      void queryClient.invalidateQueries({ queryKey: ['client-services', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['products', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['clients', selectedTenantId] })
      if (entityType === 'custom_field') {
        void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
      }
      if (entityType === 'sla_item') {
        void queryClient.invalidateQueries({ queryKey: ['sla-items', selectedTenantId] })
      }
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

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

  const handleRestore = (entityType: string, id: number) => {
    restoreMutation.mutate({ entityType, id })
  }

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

  const skeletonRows = (
    <>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </>
  )

  return (
    <Card>
      <PageHeader title="Recycle Bin" />

      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap border-b border-[var(--ui-border)]">
        <button className={tabClass('all')} onClick={() => setActiveTab('all')}>All</button>
        <button className={tabClass('client_services')} onClick={() => setActiveTab('client_services')}>Client Services</button>
        <button className={tabClass('products')} onClick={() => setActiveTab('products')}>Products</button>
        <button className={tabClass('inventory')} onClick={() => setActiveTab('inventory')}>Inventory Items</button>
        <button className={tabClass('sla_items')} onClick={() => setActiveTab('sla_items')}>SLA Items</button>
        <button className={tabClass('custom_fields')} onClick={() => setActiveTab('custom_fields')}>Custom Fields</button>
        <button className={tabClass('clients')} onClick={() => setActiveTab('clients')}>Clients</button>
      </div>

      {/* All tab */}
      {activeTab === 'all' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || buildAllItems(data).length === 0 ? (
            <EmptyState message="Recycle bin is empty." />
          ) : (
            buildAllItems(data).map((item) => (
              <RecordRow
                key={`${item.entityType}-${item.id}`}
                label={item.label}
                subLabel={item.subLabel}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore(item.entityType, item.id)}
                onForceDelete={() => void handleForceDelete(item.entityType, item.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Client Services tab */}
      {activeTab === 'client_services' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.renewables.data.length === 0 ? (
            <EmptyState message="No client services in the recycle bin." />
          ) : (
            data.renewables.data.map((r) => (
              <RecordRow
                key={r.id}
                label={r.description ?? `Client Service #${r.id}`}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('client_service', r.id)}
                onForceDelete={() => void handleForceDelete('client_service', r.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Products tab */}
      {activeTab === 'products' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.renewable_products.data.length === 0 ? (
            <EmptyState message="No products in the recycle bin." />
          ) : (
            data.renewable_products.data.map((p) => (
              <RecordRow
                key={p.id}
                label={p.name}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('product', p.id)}
                onForceDelete={() => void handleForceDelete('product', p.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Inventory tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.inventory_items.data.length === 0 ? (
            <EmptyState message="No inventory items in the recycle bin." />
          ) : (
            data.inventory_items.data.map((item) => (
              <RecordRow
                key={item.id}
                label={item.name}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('inventory', item.id)}
                onForceDelete={() => void handleForceDelete('inventory', item.id)}
              />
            ))
          )}
        </div>
      )}

      {/* SLA Items tab */}
      {activeTab === 'sla_items' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.sla_items.data.length === 0 ? (
            <EmptyState message="No SLA items in the recycle bin." />
          ) : (
            data.sla_items.data.map((item) => (
              <RecordRow
                key={item.id}
                label={item.name}
                subLabel={item.sku}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('sla_item', item.id)}
                onForceDelete={() => void handleForceDelete('sla_item', item.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Custom Fields tab */}
      {activeTab === 'custom_fields' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.custom_fields.data.length === 0 ? (
            <EmptyState message="No custom fields in the recycle bin." />
          ) : (
            data.custom_fields.data.map((field) => (
              <RecordRow
                key={field.id}
                label={field.name}
                subLabel={`${field.entity_type} · ${field.field_type}`}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('custom_field', field.id)}
                onForceDelete={() => void handleForceDelete('custom_field', field.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Clients tab */}
      {activeTab === 'clients' && (
        <div className="space-y-2">
          {isLoading ? skeletonRows : !data || data.clients.data.length === 0 ? (
            <EmptyState message="No clients in the recycle bin." />
          ) : (
            data.clients.data.map((client) => (
              <RecordRow
                key={client.id}
                label={client.name}
                isRestoring={restoreMutation.isPending}
                isDeleting={forceDeleteMutation.isPending}
                onRestore={() => handleRestore('client', client.id)}
                onForceDelete={() => void handleForceDelete('client', client.id)}
              />
            ))
          )}
        </div>
      )}
    </Card>
  )
}
