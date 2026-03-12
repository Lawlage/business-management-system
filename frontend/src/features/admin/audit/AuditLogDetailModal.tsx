import { Modal } from '../../../components/Modal'
import type { AuditLog } from '../../../types'
import { formatAuditEvent, formatDateTime } from '../../../lib/format'

type Props = {
  log: AuditLog
  timezone: string
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b border-[var(--ui-border)] last:border-0">
      <span className="text-xs font-medium text-[var(--ui-muted)]">{label}</span>
      <span className="text-xs text-[var(--ui-text)] break-all">{value}</span>
    </div>
  )
}

export function AuditLogDetailModal({ log, timezone, onClose }: Props) {
  const entityTitle =
    log.metadata && typeof log.metadata['entity_title'] === 'string'
      ? log.metadata['entity_title']
      : null

  const metaEntries = log.metadata
    ? Object.entries(log.metadata).filter(
        ([key]) => !['entity_type', 'entity_id', 'entity_title'].includes(key),
      )
    : []

  return (
    <Modal title="Audit Log Detail" onClose={onClose} maxWidth="lg">
      <div className="space-y-0.5">
        <Row label="Event" value={formatAuditEvent(log.event)} />
        <Row label="Triggered By" value={log.triggered_by_name} />
        <Row label="Entity Type" value={log.entity_type} />
        <Row label="Entity" value={entityTitle ?? log.entity_id} />
        <Row label="IP Address" value={log.ip_address} />
        <Row label="Timestamp" value={formatDateTime(log.created_at, timezone)} />
        {metaEntries.map(([key, val]) => (
          <Row
            key={key}
            label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            value={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
          />
        ))}
      </div>
    </Modal>
  )
}
