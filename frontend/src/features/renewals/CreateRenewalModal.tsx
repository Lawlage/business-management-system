import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { validate, hasErrors } from '../../lib/validation'
import type { ValidationErrors } from '../../lib/validation'
import { renewalCategoryOptions, renewalWorkflowOptions, renewalDefaults } from '../../types'

type CreateRenewalModalProps = {
  onClose: () => void
  onCreated: () => void
}

type RenewalForm = typeof renewalDefaults

export function CreateRenewalModal({ onClose, onCreated }: CreateRenewalModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<RenewalForm>({ ...renewalDefaults })
  const [errors, setErrors] = useState<ValidationErrors<RenewalForm>>({})

  const mutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/renewals', {
        method: 'POST',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewal created.')
      onCreated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleSubmit = () => {
    const newErrors = validate<RenewalForm>(
      [
        { field: 'title', required: true, message: 'Title is required.' },
        { field: 'expiration_date', required: true, message: 'Expiration date is required.' },
      ],
      form,
    )

    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    mutation.mutate()
  }

  const setField = <K extends keyof RenewalForm>(key: K, value: RenewalForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  return (
    <Modal
      title="Create Renewal"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" isLoading={mutation.isPending} onClick={handleSubmit}>
            Create Renewal
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Title"
          required
          error={errors.title}
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
        />

        <Select
          label="Type"
          value={form.category}
          onChange={(e) => setField('category', e.target.value)}
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
          error={errors.expiration_date}
          value={form.expiration_date}
          onChange={(e) => setField('expiration_date', e.target.value)}
        />

        <Select
          label="Workflow Status"
          value={form.workflow_status}
          onChange={(e) => setField('workflow_status', e.target.value)}
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
        />

        <div className="flex items-center md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={form.auto_renews}
              onChange={(e) => setField('auto_renews', e.target.checked)}
              className="rounded border-[var(--ui-border)]"
            />
            Auto-renews
          </label>
        </div>
      </div>
    </Modal>
  )
}
