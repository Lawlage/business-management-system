import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import type { InventoryItem } from '../../types'

type InventoryDetailModalProps = {
  item: InventoryItem
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
}

type InventoryForm = {
  name: string
  quantity_on_hand: number
  minimum_on_hand: number
  location: string
  vendor: string
  notes: string
}

export function InventoryDetailModal({
  item,
  onClose,
  onUpdated,
  canDelete,
}: InventoryDetailModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  const [form, setForm] = useState<InventoryForm>({
    name: item.name ?? '',
    quantity_on_hand: item.quantity_on_hand ?? 0,
    minimum_on_hand: item.minimum_on_hand ?? 0,
    location: item.location ?? '',
    vendor: item.vendor ?? '',
    notes: item.notes ?? '',
  })

  const setField = <K extends keyof InventoryForm>(key: K, value: InventoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Inventory item updated.')
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
      authedFetch(`/api/inventory/${item.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Inventory item moved to recycle bin.')
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
      title: 'Delete inventory item?',
      message: 'This will move the item to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  return (
    <Modal
      title="Inventory Detail"
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
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saveMutation.isPending}
          >
            Save Item
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />

        <Input
          label="SKU"
          value={item.sku}
          disabled
          hint="SKU cannot be changed after creation."
        />

        <Input
          label="Quantity on Hand"
          type="number"
          min={0}
          value={form.quantity_on_hand}
          onChange={(e) => setField('quantity_on_hand', Number(e.target.value))}
        />

        <Input
          label="Minimum on Hand"
          type="number"
          min={0}
          value={form.minimum_on_hand}
          onChange={(e) => setField('minimum_on_hand', Number(e.target.value))}
        />

        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setField('location', e.target.value)}
        />

        <Input
          label="Vendor"
          value={form.vendor}
          onChange={(e) => setField('vendor', e.target.value)}
        />

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
