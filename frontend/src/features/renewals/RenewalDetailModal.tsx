import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { renewalCategoryOptions, renewalWorkflowOptions } from '../../types'
import type { Renewal } from '../../types'

type RenewalDetailModalProps = {
  renewal: Renewal
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
  canEdit: boolean
}

type RenewalForm = {
  title: string
  category: string
  expiration_date: string
  workflow_status: string
  auto_renews: boolean
  notes: string
}

export function RenewalDetailModal({
  renewal,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: RenewalDetailModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  const [form, setForm] = useState<RenewalForm>({
    title: renewal.title ?? '',
    category: renewal.category ?? '',
    expiration_date: renewal.expiration_date ?? '',
    workflow_status: renewal.workflow_status ?? '',
    auto_renews: renewal.auto_renews ?? false,
    notes: renewal.notes ?? '',
  })

  const setField = <K extends keyof RenewalForm>(key: K, value: RenewalForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewals/${renewal.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewal updated.')
      onUpdated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewals/${renewal.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewal moved to recycle bin.')
      onUpdated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete renewal?',
      message: 'This will move the renewal to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  return (
    <Modal
      title="Renewal Detail"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {canDelete && (
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                isLoading={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saveMutation.isPending}
            >
              Save Renewal
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          disabled={!canEdit}
        />

        <Select
          label="Type"
          value={form.category}
          onChange={(e) => setField('category', e.target.value)}
          disabled={!canEdit}
        >
          {renewalCategoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Input
          label="Expiration Date"
          type="date"
          required
          value={form.expiration_date?.slice(0, 10) ?? ''}
          onChange={(e) => setField('expiration_date', e.target.value)}
          disabled={!canEdit}
        />

        <Select
          label="Workflow Status"
          value={form.workflow_status}
          onChange={(e) => setField('workflow_status', e.target.value)}
          disabled={!canEdit}
        >
          <option value="">Select status</option>
          {renewalWorkflowOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          disabled={!canEdit}
        />

        <div className="flex items-center md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={form.auto_renews}
              onChange={(e) => setField('auto_renews', e.target.checked)}
              disabled={!canEdit}
              className="rounded border-[var(--ui-border)]"
            />
            Auto-renews
          </label>
        </div>
      </div>
    </Modal>
  )
}
