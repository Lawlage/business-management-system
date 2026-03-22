import { useState, useRef, useEffect } from 'react'
import { Plus, X, ChevronDown, Check } from 'lucide-react'
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

const ENTITY_TYPE_OPTIONS = [
  { value: 'renewal', label: 'Renewal' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'sla_item', label: 'SLA Item' },
]

const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  currency: 'Currency ($)',
  date: 'Date',
  boolean: 'Boolean',
  json: 'JSON',
  dropdown: 'Dropdown',
}

type CreateFieldForm = {
  entity_type: string[]
  name: string
  key: string
  field_type: string
  dropdown_options: string[]
}

type EditFieldForm = {
  name: string
  entity_type: string[]
  dropdown_options: string[]
}

const initialCreateForm: CreateFieldForm = {
  entity_type: ['renewal'],
  name: '',
  key: '',
  field_type: 'text',
  dropdown_options: [],
}

function entityTypeDisplay(types: string[]): string {
  if (!types || types.length === 0) return '—'
  return types
    .map((t) => ENTITY_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(', ')
}

function nameToKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Inline multi-select combobox component
function EntityTypeCombobox({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  const displayText = value.length === 0 ? 'Select…' : entityTypeDisplay(value)

  return (
    <div ref={ref} className="relative">
      <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ui-text)' }}>
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2 text-sm text-left focus:outline-none focus:border-[var(--ui-button-bg)]"
        style={{ background: 'var(--ui-bg)', color: value.length === 0 ? 'var(--ui-muted)' : 'var(--ui-text)' }}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className="shrink-0 text-[var(--ui-muted)]" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-[var(--ui-border)] shadow-md py-1"
          style={{ background: 'var(--ui-bg)' }}
        >
          {ENTITY_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--ui-inner-bg)] transition-colors text-left"
              style={{ color: 'var(--ui-text)' }}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--ui-border)]"
                style={{
                  background: value.includes(opt.value) ? 'var(--ui-button-bg)' : 'transparent',
                  borderColor: value.includes(opt.value) ? 'var(--ui-button-bg)' : undefined,
                }}
              >
                {value.includes(opt.value) && <Check size={10} className="text-white" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {value.length === 0 && (
        <p className="mt-1 text-xs text-red-500">Select at least one entity type.</p>
      )}
    </div>
  )
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
  const [editForm, setEditForm] = useState<EditFieldForm>({ name: '', entity_type: [], dropdown_options: [] })
  const [newOptionText, setNewOptionText] = useState('')
  const [editNewOptionText, setEditNewOptionText] = useState('')

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
        body: JSON.stringify({
          ...data,
          is_required: false,
          validation_rules: [],
          dropdown_options: data.field_type === 'dropdown' ? data.dropdown_options : undefined,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Custom field created.')
      void queryClient.invalidateQueries({ queryKey: ['custom-fields', selectedTenantId] })
      setCreateForm(initialCreateForm)
      setNewOptionText('')
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
    setEditForm({
      name: field.name,
      entity_type: Array.isArray(field.entity_type) ? field.entity_type : [field.entity_type],
      dropdown_options: field.dropdown_options ?? [],
    })
    setEditNewOptionText('')
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
        description="Define custom fields to capture additional data on products, services, and clients."
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
                  {entityTypeDisplay(Array.isArray(field.entity_type) ? field.entity_type : [field.entity_type])}
                  {' \u2014 '}
                  {fieldTypeLabels[field.field_type] ?? field.field_type}
                  {field.field_type === 'dropdown' && field.dropdown_options && field.dropdown_options.length > 0 && (
                    <span> · {field.dropdown_options.join(', ')}</span>
                  )}
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
                disabled={createForm.entity_type.length === 0}
              >
                Create Field
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <EntityTypeCombobox
              label="Applies To"
              value={createForm.entity_type}
              onChange={(v) => setCreateForm((f) => ({ ...f, entity_type: v }))}
            />
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
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  field_type: e.target.value,
                  dropdown_options: [],
                }))
              }
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
              <option value="dropdown">Dropdown</option>
              <option value="json">JSON</option>
            </Select>

            {createForm.field_type === 'dropdown' && (
              <div>
                <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ui-text)' }}>
                  Dropdown Options <span className="text-red-500 ml-0.5">*</span>
                </p>
                <div className="space-y-1.5 mb-2">
                  {createForm.dropdown_options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm px-2 py-1 rounded border border-[var(--ui-border)] bg-[var(--ui-inner-bg)] text-[var(--ui-text)]">{opt}</span>
                      <button
                        type="button"
                        onClick={() => setCreateForm((f) => ({
                          ...f,
                          dropdown_options: f.dropdown_options.filter((_, i) => i !== idx),
                        }))}
                        className="text-[var(--ui-muted)] hover:text-red-500 transition p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add option..."
                    value={newOptionText}
                    onChange={(e) => setNewOptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newOptionText.trim()) {
                        e.preventDefault()
                        setCreateForm((f) => ({
                          ...f,
                          dropdown_options: [...f.dropdown_options, newOptionText.trim()],
                        }))
                        setNewOptionText('')
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
                    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newOptionText.trim()) return
                      setCreateForm((f) => ({
                        ...f,
                        dropdown_options: [...f.dropdown_options, newOptionText.trim()],
                      }))
                      setNewOptionText('')
                    }}
                    className="px-2 py-1.5 rounded border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {createForm.dropdown_options.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">At least one option is required for dropdown fields.</p>
                )}
              </div>
            )}
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
                disabled={editForm.entity_type.length === 0 || (editingField.field_type === 'dropdown' && editForm.dropdown_options.length === 0)}
              >
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <EntityTypeCombobox
              label="Applies To"
              value={editForm.entity_type}
              onChange={(v) => setEditForm((f) => ({ ...f, entity_type: v }))}
            />
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

            {editingField.field_type === 'dropdown' && (
              <div>
                <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--ui-text)' }}>
                  Dropdown Options <span className="text-red-500 ml-0.5">*</span>
                </p>
                <div className="space-y-1.5 mb-2">
                  {editForm.dropdown_options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm px-2 py-1 rounded border border-[var(--ui-border)] bg-[var(--ui-inner-bg)] text-[var(--ui-text)]">{opt}</span>
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => ({
                          ...f,
                          dropdown_options: f.dropdown_options.filter((_, i) => i !== idx),
                        }))}
                        className="text-[var(--ui-muted)] hover:text-red-500 transition p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add option..."
                    value={editNewOptionText}
                    onChange={(e) => setEditNewOptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editNewOptionText.trim()) {
                        e.preventDefault()
                        setEditForm((f) => ({
                          ...f,
                          dropdown_options: [...f.dropdown_options, editNewOptionText.trim()],
                        }))
                        setEditNewOptionText('')
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
                    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!editNewOptionText.trim()) return
                      setEditForm((f) => ({
                        ...f,
                        dropdown_options: [...f.dropdown_options, editNewOptionText.trim()],
                      }))
                      setEditNewOptionText('')
                    }}
                    className="px-2 py-1.5 rounded border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {editForm.dropdown_options.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">At least one option is required for dropdown fields.</p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </Card>
  )
}
