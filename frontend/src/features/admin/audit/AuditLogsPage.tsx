import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useApi } from '../../../hooks/useApi'
import type { AuditLog, TenantAuditData } from '../../../types'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonRow } from '../../../components/SkeletonRow'
import { LoadMoreButton } from '../../../components/LoadMoreButton'
import { formatDateTime, formatAuditEvent } from '../../../lib/format'

export function AuditLogsPage() {
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { authedFetch } = useApi()

  const [tenantPage, setTenantPage] = useState(1)
  const [bgPage, setBgPage] = useState(1)
  const [tenantEvents, setTenantEvents] = useState<AuditLog[]>([])
  const [bgEvents, setBgEvents] = useState<AuditLog[]>([])

  const { data, isLoading } = useQuery<TenantAuditData>({
    queryKey: ['tenant-audit', selectedTenantId, tenantPage, bgPage],
    queryFn: () =>
      authedFetch<TenantAuditData>(
        `/api/audit-logs?page=${tenantPage}&break_glass_page=${bgPage}`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId,
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

  return (
    <Card>
      <PageHeader title="Audit Logs" />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Tenant Events */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--ui-text)]">Tenant Events</h3>
          <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
            {isLoading && tenantEvents.length === 0 && (
              <div className="space-y-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {!isLoading && tenantEvents.length === 0 && (
              <EmptyState message="No audit events recorded yet." />
            )}

            {tenantEvents.length > 0 && (
              <div className="space-y-2">
                {tenantEvents.map((log) => (
                  <div
                    key={log.id}
                    className="rounded border border-[var(--ui-border)] px-3 py-2"
                  >
                    <p className="text-sm text-[var(--ui-text)]">
                      {formatAuditEvent(log.event)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                      {formatDateTime(log.created_at, tenantTimezone)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <LoadMoreButton
              hasMore={tenantHasMore}
              isLoading={isLoading}
              onLoadMore={() => setTenantPage((p) => p + 1)}
            />
          </div>
        </div>

        {/* Break-Glass Events */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--ui-text)]">
            Break-Glass Events
          </h3>
          <div className="app-inner-box rounded-md border border-[var(--ui-border)] p-3">
            {isLoading && bgEvents.length === 0 && (
              <div className="space-y-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {!isLoading && bgEvents.length === 0 && (
              <EmptyState message="No audit events recorded yet." />
            )}

            {bgEvents.length > 0 && (
              <div className="space-y-2">
                {bgEvents.map((log) => (
                  <div
                    key={log.id}
                    className="rounded border border-[var(--ui-border)] px-3 py-2"
                  >
                    <p className="text-sm text-[var(--ui-text)]">
                      {formatAuditEvent(log.event)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                      {formatDateTime(log.created_at, tenantTimezone)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <LoadMoreButton
              hasMore={bgHasMore}
              isLoading={isLoading}
              onLoadMore={() => setBgPage((p) => p + 1)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
