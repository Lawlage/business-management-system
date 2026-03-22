import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { useApi } from '../../../hooks/useApi'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import type { Department, TenantUserMembership } from '../../../types'

function DepartmentsContent() {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null)

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
  })

  const { data: tenantUsers = [] } = useQuery<TenantUserMembership[]>({
    queryKey: ['tenant-users', selectedTenantId],
    queryFn: () => authedFetch<TenantUserMembership[]>('/api/tenant-users', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name, manager_id }: { id: number; name: string; manager_id: number | null }) =>
      authedFetch(`/api/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, manager_id }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Department updated.')
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ['departments', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to update department.', 'error')
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      authedFetch('/api/departments', {
        method: 'POST',
        body: JSON.stringify({ name }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Department created.')
      setNewName('')
      void queryClient.invalidateQueries({ queryKey: ['departments', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create department.', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authedFetch(`/api/departments/${id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Department deleted.')
      void queryClient.invalidateQueries({ queryKey: ['departments', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to delete department.', 'error')
    },
  })

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createMutation.mutate(trimmed)
  }

  const handleDelete = async (dept: Department) => {
    const confirmed = await confirm({
      title: 'Delete department?',
      message: `Delete "${dept.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate(dept.id)
  }

  return (
    <Card>
      <PageHeader title="Departments" description="Organise users and records by department." />

      {/* Add department form */}
      <div className="mb-6 flex gap-2">
        <Input
          placeholder="New department name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          isLoading={createMutation.isPending}
          disabled={!newName.trim()}
        >
          Add
        </Button>
      </div>

      {/* Department list */}
      {isLoading ? (
        <p className="text-sm text-[var(--ui-muted)]">Loading...</p>
      ) : departments.length === 0 ? (
        <EmptyState message="No departments yet. Add one above." />
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="app-inner-box rounded-md border border-[var(--ui-border)] px-3 py-2"
            >
              {editingId === dept.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-[var(--ui-border)] text-sm focus:outline-none"
                    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
                    autoFocus
                  />
                  <select
                    value={editingManagerId ?? ''}
                    onChange={(e) => setEditingManagerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2 py-1 rounded border border-[var(--ui-border)] text-sm focus:outline-none"
                    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
                  >
                    <option value="">No manager</option>
                    {tenantUsers.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.first_name} {m.user.last_name}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => updateMutation.mutate({ id: dept.id, name: editingName.trim(), manager_id: editingManagerId })}
                      className="text-green-500 hover:text-green-400 transition p-1"
                      aria-label="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition p-1"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--ui-text)]">{dept.name}</p>
                    {dept.manager && (
                      <p className="text-xs text-[var(--ui-muted)]">
                        Manager: {dept.manager.first_name} {dept.manager.last_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(dept.id)
                        setEditingName(dept.name)
                        setEditingManagerId(dept.manager_id ?? null)
                      }}
                      className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition p-1 rounded"
                      aria-label={`Edit ${dept.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void handleDelete(dept)}
                      className="text-[var(--ui-muted)] hover:text-red-500 transition p-1 rounded"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function DepartmentsPage() {
  return (
    <ErrorBoundary>
      <DepartmentsContent />
    </ErrorBoundary>
  )
}
