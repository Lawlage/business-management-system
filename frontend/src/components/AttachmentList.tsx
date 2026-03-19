import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, FileText } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useTenant } from '../contexts/TenantContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useNotice } from '../contexts/NoticeContext'
import { FileUpload } from './FileUpload'
import type { Attachment } from '../types'

type Props = {
  entityType: 'renewal' | 'renewable' | 'renewable_product' | 'inventory' | 'client' | 'sla_item'
  entityId: number
  canEdit: boolean
  hideUpload?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentList({ entityType, entityId, canEdit, hideUpload = false }: Props) {
  const { authedFetch, getHeaders } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const queryKey = ['attachments', selectedTenantId, entityType, entityId]

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey,
    queryFn: () =>
      authedFetch<Attachment[]>(`/api/attachments/${entityType}/${entityId}`, { tenantScoped: true }),
    enabled: !!selectedTenantId && entityId > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentLinkId: number) =>
      authedFetch(`/api/attachments/${attachmentLinkId}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Attachment deleted.')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => showNotice('Failed to delete attachment.', 'error'),
  })

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', entityType)
      formData.append('entity_id', String(entityId))

      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: getHeaders({ tenantScoped: true, isFormData: true }),
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { message?: string })?.message ?? 'Upload failed.')
      }

      showNotice('File uploaded.')
      queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      showNotice((err as { message?: string })?.message ?? 'Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachment: Attachment) {
    const ok = await confirm({
      title: 'Delete attachment?',
      message: `Delete "${attachment.original_name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(attachment.id)
  }

  function handleDownload(attachment: Attachment) {
    // Open download via a temporary anchor to trigger browser download behaviour
    const headers = getHeaders({ tenantScoped: true })
    // We build a fetch-based download to pass auth headers
    void fetch(`/api/attachments/${attachment.id}/download`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error('Download failed.')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = attachment.original_name
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }, 200)
      })
      .catch(() => showNotice('Download failed.', 'error'))
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--ui-text-muted, var(--ui-text))' }}>
          No attachments yet.
        </p>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded border p-2 text-sm"
              style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg)' }}
            >
              <FileText size={16} className="shrink-0" style={{ color: 'var(--ui-text-muted, var(--ui-text))' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--ui-text)' }}>
                {att.original_name}
              </span>
              <span className="shrink-0 text-xs" style={{ color: 'var(--ui-text-muted, var(--ui-text))' }}>
                {formatBytes(att.size)}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(att)}
                className="shrink-0 p-1 rounded hover:bg-[var(--ui-border)]"
                title="Download"
              >
                <Download size={14} />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  className="shrink-0 p-1 rounded hover:bg-red-50 text-red-500"
                  title="Delete"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !hideUpload && (
        <FileUpload onUpload={handleUpload} isUploading={uploading} disabled={entityId <= 0} />
      )}
    </div>
  )
}
