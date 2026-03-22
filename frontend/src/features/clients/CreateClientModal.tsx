import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { useTenant } from '../../contexts/TenantContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { validate, hasErrors } from '../../lib/validation'
import type { ValidationErrors } from '../../lib/validation'
import { clientDefaults } from '../../types'
import type { AccountManager } from '../../types'

type CreateClientModalProps = {
  onClose: () => void
  onCreated: () => void
}

type ClientForm = typeof clientDefaults

export function CreateClientModal({ onClose, onCreated }: CreateClientModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const { selectedTenantId } = useTenant()

  const [form, setForm] = useState<ClientForm>({ ...clientDefaults })
  const [errors, setErrors] = useState<ValidationErrors<ClientForm>>({})

  const { data: accountManagers = [] } = useQuery<AccountManager[]>({
    queryKey: ['account-managers', selectedTenantId],
    queryFn: () => authedFetch<AccountManager[]>('/api/account-managers', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      await authedFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(data),
        tenantScoped: true,
      })
    },
    onSuccess: () => {
      showNotice('Client created.')
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
    const newErrors = validate<ClientForm>(
      [{ field: 'name', required: true, message: 'Name is required.' }],
      form,
    )

    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    const submittedForm = { ...form }
    if (submittedForm.website && !/^https?:\/\//i.test(submittedForm.website)) {
      submittedForm.website = `https://${submittedForm.website}`
    }

    mutation.mutate(submittedForm)
  }

  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  return (
    <Modal
      title="Create Client"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" isLoading={mutation.isPending} onClick={handleSubmit}>
            Create Client
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          error={errors.name}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />

        <Input
          label="Contact Name"
          value={form.contact_name}
          onChange={(e) => setField('contact_name', e.target.value)}
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
        />

        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
        />

        <Input
          label="Website"
          type="url"
          value={form.website}
          onChange={(e) => setField('website', e.target.value)}
        />

        <Select
          label="Account Manager"
          value={form.account_manager_id ?? ''}
          onChange={(e) =>
            setField('account_manager_id', e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">None</option>
          {accountManagers.map((am) => (
            <option key={am.id} value={am.id}>
              {am.name}
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
      </div>
    </Modal>
  )
}
