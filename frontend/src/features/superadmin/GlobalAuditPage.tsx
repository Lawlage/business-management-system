import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import type { AuditLog } from '../../types'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { formatDateTime, formatAuditEvent } from '../../lib/format'

export function GlobalAuditPage() {
  const { authedFetch } = useApi()

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['global-audit'],
    queryFn: () => authedFetch<AuditLog[]>('/api/superadmin/audit-logs'),
  })

  return (
    <Card>
      <PageHeader title="Global Audit Log" />

      {isLoading && (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {!isLoading && logs && logs.length === 0 && (
        <EmptyState message="No audit events recorded yet." />
      )}

      {!isLoading && logs && logs.length > 0 && (
        <div className="max-h-[600px] space-y-2 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-md border border-[var(--ui-border)] app-inner-box px-3 py-2"
            >
              <p className="text-sm text-[var(--ui-text)]">{formatAuditEvent(log.event)}</p>
              <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                {formatDateTime(log.created_at, 'UTC')}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
