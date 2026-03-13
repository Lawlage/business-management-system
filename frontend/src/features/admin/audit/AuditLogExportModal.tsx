import { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { Modal } from '../../../components/Modal'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'

type Props = {
  defaultType: 'tenant' | 'break_glass'
  onClose: () => void
}

export function AuditLogExportModal({ defaultType, onClose }: Props) {
  const { token } = useAuth()
  const { selectedTenantId, breakGlassToken, role } = useTenant()
  const { showNotice } = useNotice()

  const [type, setType] = useState<'tenant' | 'break_glass'>(defaultType)
  const [event, setEvent] = useState('')
  const [triggeredBy, setTriggeredBy] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ type })
      if (event) params.set('event', event)
      if (triggeredBy) params.set('triggered_by_name', triggeredBy)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const headers = new Headers({
        Accept: 'text/csv',
        Authorization: `Bearer ${token ?? ''}`,
        'X-Tenant-Id': selectedTenantId ?? '',
      })
      if (role === 'global_superadmin' && breakGlassToken) {
        headers.set('X-Break-Glass-Token', breakGlassToken)
      }

      const response = await fetch(`/api/audit-logs/export?${params.toString()}`, { headers })

      if (!response.ok) {
        showNotice('Export failed. Please try again.', 'error')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : 'audit-log.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch {
      showNotice('Export failed. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      title="Export Audit Log"
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isLoading} onClick={handleExport}>
            Download CSV
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Select
          label="Log type"
          value={type}
          onChange={(e) => setType(e.target.value as 'tenant' | 'break_glass')}
        >
          <option value="tenant">Tenant Events</option>
          <option value="break_glass">Break-Glass Events</option>
        </Select>

        <Input
          label="Event contains"
          placeholder="e.g. renewal.created, membership"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        />

        <Input
          label="Actioning user contains"
          placeholder="e.g. Admin, superadmin@"
          value={triggeredBy}
          onChange={(e) => setTriggeredBy(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="From"
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="datetime-local"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <p className="text-xs text-[var(--ui-muted)]">
          Leave filters blank to export all records. Results are ordered newest first.
        </p>
      </div>
    </Modal>
  )
}
