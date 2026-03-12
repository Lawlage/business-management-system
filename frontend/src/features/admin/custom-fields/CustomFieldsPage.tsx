import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { useApi } from '../../../hooks/useApi'
import type { ApiError } from '../../../hooks/useApi'
import type { CustomField } from '../../../types'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonRow } from '../../../components/SkeletonRow'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'

type CreateFieldForm = {
  entity_type: 'renewal' | 'inventory'
  name: string
  key: string
  field_type: string
}

const initialForm: CreateFieldForm = {
  entity_type: 'renewal',
  name: '',
  key: '',
  field_type: 'text',
}

export function CustomFieldsPage() {
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<CreateFieldForm>(initialForm)

  const { data: fields, isLoading } = useQuery<CustomField[]>({
    queryKey: ['custom-fields', selectedTenantId],
    queryFn: () =>
      authedFetch<CustomField[]>('/api/custom-fields', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFieldForm) =>
      authedFetch('/api/custom-fields', {
        method: 'POST',
        body: JSON.stringify({ ...data, is_required: false, validation_rules: [] }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Custom field created.')
      void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
      setForm(initialForm)
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authedFetch(`/api/custom-fields/${id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Custom field deleted.')
      void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Delete custom field?',
      message: 'This will permanently remove the field and all stored values.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id)
  }

  function handleCreate() {
    createMutation.mutate(form)
  }

  return (
    <Card>
      <PageHeader title="Custom Fields" />

      <div className="mb-4 grid gap-2 md:grid-cols-5">
        <Select
          value={form.entity_type}
          onChange={(e) =>
            setForm((f) => ({ ...f, entity_type: e.target.value as 'renewal' | 'inventory' }))
          }
        >
          <option value="renewal">Renewal</option>
          <option value="inventory">Inventory</option>
        </Select>
        <Input
          placeholder="Field Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="field_key"
          value={form.key}
          onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
        />
        <Select
          value={form.field_type}
          onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Boolean</option>
          <option value="json">JSON</option>
        </Select>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          isLoading={createMutation.isPending}
        >
          Add Field
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {!isLoading && fields && fields.length === 0 && (
          <EmptyState message="No custom fields defined." />
        )}

        {!isLoading &&
          fields &&
          fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between rounded-md border border-[var(--ui-border)] app-inner-box p-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ui-text)]">
                  {field.name}{' '}
                  <span className="text-[var(--ui-muted)]">({field.key})</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  {field.entity_type} &mdash; {field.field_type}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete(field.id)}
                isLoading={
                  deleteMutation.isPending &&
                  (deleteMutation.variables as number | undefined) === field.id
                }
              >
                Delete
              </Button>
            </div>
          ))}
      </div>
    </Card>
  )
}
