import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
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
import type { Department } from '../../../types'

function DepartmentsContent() {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [newName, setNewName] = useState('')

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
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
      <PageHeader title="Departments" />

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
              className="app-inner-box flex items-center justify-between rounded-md border border-[var(--ui-border)] px-3 py-2"
            >
              <span className="text-sm text-[var(--ui-text)]">{dept.name}</span>
              <button
                onClick={() => void handleDelete(dept)}
                className="text-[var(--ui-muted)] hover:text-red-500 transition p-1 rounded"
                aria-label={`Delete ${dept.name}`}
              >
                <Trash2 size={14} />
              </button>
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
