import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { validate, hasErrors } from '../../lib/validation'
import type { ValidationErrors } from '../../lib/validation'
import { inventoryDefaults } from '../../types'

type CreateInventoryModalProps = {
  onClose: () => void
  onCreated: () => void
}

type InventoryForm = typeof inventoryDefaults

export function CreateInventoryModal({ onClose, onCreated }: CreateInventoryModalProps) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<InventoryForm>({ ...inventoryDefaults })
  const [errors, setErrors] = useState<ValidationErrors<InventoryForm>>({})

  const mutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Inventory item created.')
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
    const newErrors = validate<InventoryForm>(
      [
        { field: 'name', required: true, message: 'Name is required.' },
        { field: 'sku', required: true, message: 'SKU is required.' },
        { field: 'quantity_on_hand', min: 0, message: 'Quantity must be 0 or greater.' },
        { field: 'minimum_on_hand', min: 0, message: 'Minimum must be 0 or greater.' },
      ],
      form,
    )

    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    mutation.mutate()
  }

  const setField = <K extends keyof InventoryForm>(key: K, value: InventoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  return (
    <Modal
      title="Create Inventory Item"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" isLoading={mutation.isPending} onClick={handleSubmit}>
            Create Item
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
          label="SKU"
          required
          error={errors.sku}
          value={form.sku}
          onChange={(e) => setField('sku', e.target.value)}
        />

        <Input
          label="Quantity on Hand"
          type="number"
          min={0}
          error={errors.quantity_on_hand}
          value={form.quantity_on_hand}
          onChange={(e) => setField('quantity_on_hand', Number(e.target.value))}
        />

        <Input
          label="Minimum on Hand"
          type="number"
          min={0}
          error={errors.minimum_on_hand}
          value={form.minimum_on_hand}
          onChange={(e) => setField('minimum_on_hand', Number(e.target.value))}
        />
      </div>
    </Modal>
  )
}
