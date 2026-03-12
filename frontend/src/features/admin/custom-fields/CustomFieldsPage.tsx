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
import { Modal } from '../../../components/Modal'

type CreateFieldForm = {
  entity_type: 'renewal' | 'inventory' | 'both'
  name: string
  key: string
  field_type: string
}

type EditFieldForm = {
  name: string
  entity_type: 'renewal' | 'inventory' | 'both'
}

const initialCreateForm: CreateFieldForm = {
  entity_type: 'renewal',
  name: '',
  key: '',
  field_type: 'text',
}

const entityTypeLabels: Record<string, string> = {
  renewal: 'Renewal',
  inventory: 'Inventory',
  both: 'Both',
}

const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  currency: 'Currency ($)',
  date: 'Date',
  boolean: 'Boolean',
  json: 'JSON',
}

function nameToKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function CustomFieldsPage() {
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFieldForm>(initialCreateForm)

  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [editForm, setEditForm] = useState<EditFieldForm>({ name: '', entity_type: 'renewal' })

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
      setCreateForm(initialCreateForm)
      setIsCreateOpen(false)
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditFieldForm }) =>
      authedFetch(`/api/custom-fields/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Custom field updated.')
      void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
      setEditingField(null)
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
      showNotice('Custom field moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Delete custom field?',
      message: 'This will move the field to the recycle bin. Existing values will be preserved if restored.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id)
  }

  function openEdit(field: CustomField) {
    setEditingField(field)
    setEditForm({ name: field.name, entity_type: field.entity_type })
  }

  function handleNameChange(name: string) {
    setCreateForm((f) => ({
      ...f,
      name,
      key: nameToKey(name),
    }))
  }

  return (
    <Card>
      <PageHeader
        title="Custom Fields"
        action={
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Create Field
          </Button>
        }
      />

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
            <button
              key={field.id}
              className="w-full flex items-center justify-between rounded-md border border-[var(--ui-border)] app-inner-box p-3 text-left hover:bg-[var(--ui-inner-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => openEdit(field)}
            >
              <div>
                <p className="text-sm font-medium text-[var(--ui-text)]">
                  {field.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  {entityTypeLabels[field.entity_type] ?? field.entity_type}
                  {' \u2014 '}
                  {fieldTypeLabels[field.field_type] ?? field.field_type}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => void handleDelete(e, field.id)}
                isLoading={
                  deleteMutation.isPending &&
                  (deleteMutation.variables as number | undefined) === field.id
                }
              >
                Delete
              </Button>
            </button>
          ))}
      </div>

      {/* Create modal */}
      {isCreateOpen && (
        <Modal
          title="Create Custom Field"
          maxWidth="md"
          onClose={() => {
            setIsCreateOpen(false)
            setCreateForm(initialCreateForm)
          }}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateOpen(false)
                  setCreateForm(initialCreateForm)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => createMutation.mutate(createForm)}
                isLoading={createMutation.isPending}
              >
                Create Field
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <Select
              label="Applies To"
              value={createForm.entity_type}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  entity_type: e.target.value as CreateFieldForm['entity_type'],
                }))
              }
            >
              <option value="renewal">Renewal</option>
              <option value="inventory">Inventory</option>
              <option value="both">Both</option>
            </Select>
            <div>
              <Input
                label="Field Name"
                placeholder="e.g. Contract Value"
                value={createForm.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              {createForm.key && (
                <p className="mt-1 text-xs text-[var(--ui-muted)]">
                  Key: <span className="font-mono">{createForm.key}</span>
                  <span className="ml-2 opacity-60">— machine-readable identifier, set once</span>
                </p>
              )}
            </div>
            <Select
              label="Field Type"
              value={createForm.field_type}
              onChange={(e) => setCreateForm((f) => ({ ...f, field_type: e.target.value }))}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
              <option value="json">JSON</option>
            </Select>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editingField && (
        <Modal
          title="Edit Custom Field"
          maxWidth="md"
          onClose={() => setEditingField(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => updateMutation.mutate({ id: editingField.id, data: editForm })}
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <Select
              label="Applies To"
              value={editForm.entity_type}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  entity_type: e.target.value as EditFieldForm['entity_type'],
                }))
              }
            >
              <option value="renewal">Renewal</option>
              <option value="inventory">Inventory</option>
              <option value="both">Both</option>
            </Select>
            <Input
              label="Field Name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-inner-bg)] px-3 py-2 text-sm text-[var(--ui-muted)]">
              <span className="font-medium text-[var(--ui-text)]">Type:</span>{' '}
              {fieldTypeLabels[editingField.field_type] ?? editingField.field_type}
              <span className="mx-2 opacity-40">·</span>
              <span className="font-medium text-[var(--ui-text)]">Key:</span>{' '}
              <span className="font-mono">{editingField.key}</span>
              <p className="mt-1 text-xs opacity-60">Type and key cannot be changed after creation.</p>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  )
}
