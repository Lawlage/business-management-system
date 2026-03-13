import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useApi } from '../../../hooks/useApi'
import type { AuditLog, TenantAuditData } from '../../../types'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonRow } from '../../../components/SkeletonRow'
import { formatDateTime, formatAuditEvent } from '../../../lib/format'
import { AuditLogDetailModal } from './AuditLogDetailModal'
import { AuditLogExportModal } from './AuditLogExportModal'
import { Button } from '../../../components/Button'

type Tab = 'tenant' | 'break-glass'

export function AuditLogsPage() {
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { authedFetch } = useApi()

  const [activeTab, setActiveTab] = useState<Tab>('tenant')
  const [tenantPage, setTenantPage] = useState(1)
  const [bgPage, setBgPage] = useState(1)
  const [tenantEvents, setTenantEvents] = useState<AuditLog[]>([])
  const [bgEvents, setBgEvents] = useState<AuditLog[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)

  const { data, isLoading } = useQuery<TenantAuditData>({
    queryKey: ['tenant-audit', selectedTenantId, tenantPage, bgPage],
    queryFn: () =>
      authedFetch<TenantAuditData>(
        `/api/audit-logs?page=${tenantPage}&break_glass_page=${bgPage}`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!data) return
    const incoming = data.tenant_logs.data
    setTenantEvents((prev) => (tenantPage === 1 ? incoming : [...prev, ...incoming]))
  }, [data, tenantPage])

  useEffect(() => {
    if (!data) return
    const incoming = data.break_glass_logs.data
    setBgEvents((prev) => (bgPage === 1 ? incoming : [...prev, ...incoming]))
  }, [data, bgPage])

  // Reset accumulated lists when tenant changes
  useEffect(() => {
    setTenantPage(1)
    setBgPage(1)
    setTenantEvents([])
    setBgEvents([])
  }, [selectedTenantId])

  const tenantHasMore =
    !!data && data.tenant_logs.current_page < data.tenant_logs.last_page
  const bgHasMore =
    !!data && data.break_glass_logs.current_page < data.break_glass_logs.last_page

  function getEntityTitle(log: AuditLog): string | null {
    if (log.metadata && typeof log.metadata['entity_title'] === 'string') {
      return log.metadata['entity_title']
    }
    return null
  }

  function renderLogRow(log: AuditLog) {
    const entityTitle = getEntityTitle(log)
    return (
      <button
        key={log.id}
        className="w-full text-left rounded border border-[var(--ui-border)] px-3 py-2 hover:bg-[var(--ui-inner-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
        onClick={() => setSelectedLog(log)}
      >
        <p className="text-sm text-[var(--ui-text)]">
          {formatAuditEvent(log.event)}
          {entityTitle && (
            <span className="ml-1 text-[var(--ui-muted)]">— {entityTitle}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
          {log.triggered_by_name && (
            <span className="mr-2">actioning user: {log.triggered_by_name}</span>
          )}
          {formatDateTime(log.created_at, tenantTimezone)}
        </p>
      </button>
    )
  }

  function renderLogList(
    events: AuditLog[],
    hasMore: boolean,
    onLoadMore: () => void,
  ) {
    return (
      <div className="flex flex-col gap-2">
        <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3 h-[480px] overflow-y-auto">
          {isLoading && events.length === 0 && (
            <div className="space-y-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {!isLoading && events.length === 0 && (
            <EmptyState message="No audit events recorded yet." />
          )}

          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((log) => renderLogRow(log))}
            </div>
          )}
        </div>

        {hasMore && (
          <button
            className="text-xs text-[var(--ui-accent)] hover:underline self-start"
            disabled={isLoading}
            onClick={onLoadMore}
          >
            {isLoading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tenant', label: 'Tenant Events' },
    { key: 'break-glass', label: 'Break-Glass Events' },
  ]

  return (
    <Card>
      <PageHeader
        title="Audit Logs"
        action={
          <Button variant="secondary" size="sm" onClick={() => setIsExportOpen(true)}>
            Export CSV
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]'
                : 'border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tenant' &&
        renderLogList(tenantEvents, tenantHasMore, () => setTenantPage((p) => p + 1))}

      {activeTab === 'break-glass' &&
        renderLogList(bgEvents, bgHasMore, () => setBgPage((p) => p + 1))}

      {selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          timezone={tenantTimezone}
          onClose={() => setSelectedLog(null)}
        />
      )}

      {isExportOpen && (
        <AuditLogExportModal
          defaultType={activeTab === 'break-glass' ? 'break_glass' : 'tenant'}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </Card>
  )
}
