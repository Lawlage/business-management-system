import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import type { Client } from '../../types'

type ClientDetailModalProps = {
  client: Client
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
  canEdit: boolean
}

type ClientForm = {
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
}

export function ClientDetailModal({
  client,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: ClientDetailModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  const [form, setForm] = useState<ClientForm>({
    name: client.name ?? '',
    contact_name: client.contact_name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    notes: client.notes ?? '',
  })

  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await authedFetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        tenantScoped: true,
      })
    },
    onSuccess: () => {
      showNotice('Client updated.')
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
      authedFetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Client moved to recycle bin.')
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
      title: 'Delete client?',
      message: 'This will move the client to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  return (
    <Modal
      title="Client Detail"
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
              Save Client
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Contact Name"
          value={form.contact_name}
          onChange={(e) => setField('contact_name', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Website"
          type="url"
          value={form.website}
          onChange={(e) => setField('website', e.target.value)}
          disabled={!canEdit}
        />

        <div /> {/* spacer for grid alignment */}

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          disabled={!canEdit}
        />
      </div>
    </Modal>
  )
}
