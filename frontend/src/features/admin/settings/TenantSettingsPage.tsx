import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { useApi } from '../../../hooks/useApi'
import type { ApiError } from '../../../hooks/useApi'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { PageHeader } from '../../../components/PageHeader'
import { Select } from '../../../components/Select'
import { TimezoneSelect } from '../../../components/TimezoneSelect'
import {
  densityOptions,
  fontFamilyOptions,
} from '../../../uiSettings'
import type { DensityMode, FontFamilyMode } from '../../../uiSettings'
import type { SlaGroup } from '../../../types'

export function TenantSettingsPage() {
  const {
    tenantTimezone,
    setTenantTimezone,
    tenantUiSettings,
    setTenantUiSettings,
    selectedTenantId,
  } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')

  const { data: slaGroups = [] } = useQuery<SlaGroup[]>({
    queryKey: ['sla-groups', selectedTenantId],
    queryFn: () => authedFetch<SlaGroup[]>('/api/sla-groups', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      authedFetch('/api/sla-groups', { method: 'POST', body: JSON.stringify({ name }), tenantScoped: true }),
    onSuccess: () => {
      showNotice('SLA group created.')
      setNewGroupName('')
      void queryClient.invalidateQueries({ queryKey: ['sla-groups', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create SLA group.', 'error')
    },
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      authedFetch(`/api/sla-groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }), tenantScoped: true }),
    onSuccess: () => {
      showNotice('SLA group updated.')
      setEditingGroupId(null)
      void queryClient.invalidateQueries({ queryKey: ['sla-groups', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to update SLA group.', 'error')
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) =>
      authedFetch(`/api/sla-groups/${id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('SLA group deleted.')
      void queryClient.invalidateQueries({ queryKey: ['sla-groups', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to delete SLA group.', 'error')
    },
  })

  const handleDeleteGroup = async (group: SlaGroup) => {
    const confirmed = await confirm({
      title: 'Delete SLA group?',
      message: `Delete "${group.name}"? SLA items will lose their group assignment.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteGroupMutation.mutate(group.id)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify({
          timezone: tenantTimezone,
          ui_settings: tenantUiSettings,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Settings saved.')
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  return (
    <Card>
      <PageHeader title="Tenant Settings" />

      <div className="space-y-6">
        {/* Timezone */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">Timezone</h3>
          <div className="max-w-sm">
            <TimezoneSelect
              value={tenantTimezone}
              onChange={setTenantTimezone}
              label="Timezone"
            />
          </div>
        </div>

        {/* Layout & Typography */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">
            Layout &amp; Typography
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Layout Density"
              value={tenantUiSettings.density}
              onChange={(e) =>
                setTenantUiSettings({
                  ...tenantUiSettings,
                  density: e.target.value as DensityMode,
                })
              }
            >
              {densityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select
              label="Typography"
              value={tenantUiSettings.font_family}
              onChange={(e) =>
                setTenantUiSettings({
                  ...tenantUiSettings,
                  font_family: e.target.value as FontFamilyMode,
                })
              }
            >
              {fontFamilyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* SLA Groups */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">SLA Groups</h3>
          <div className="mb-3 flex gap-2">
            <Input
              placeholder="New group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim()) }}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => { if (newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim()) }}
              isLoading={createGroupMutation.isPending}
              disabled={!newGroupName.trim()}
            >
              Add
            </Button>
          </div>
          {slaGroups.length === 0 ? (
            <p className="text-sm text-[var(--ui-muted)]">No SLA groups yet.</p>
          ) : (
            <div className="space-y-1">
              {slaGroups.map((group) => (
                <div key={group.id} className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] px-3 py-2">
                  {editingGroupId === group.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() })
                          if (e.key === 'Escape') setEditingGroupId(null)
                        }}
                        className="flex-1 px-2 py-1 rounded border border-[var(--ui-border)] text-sm focus:outline-none"
                        style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
                        autoFocus
                      />
                      <button
                        onClick={() => updateGroupMutation.mutate({ id: group.id, name: editingGroupName.trim() })}
                        className="text-green-500 hover:text-green-400 transition p-1"
                        aria-label="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingGroupId(null)}
                        className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition p-1"
                        aria-label="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-[var(--ui-text)]">{group.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name) }}
                          className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition p-1 rounded"
                          aria-label={`Edit ${group.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => void handleDeleteGroup(group)}
                          className="text-[var(--ui-muted)] hover:text-red-500 transition p-1 rounded"
                          aria-label={`Delete ${group.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex flex-wrap gap-2 border-t border-[var(--ui-border)] pt-4">
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </Card>
  )
}
