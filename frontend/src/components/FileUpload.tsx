import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

type Props = {
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
  isUploading?: boolean
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
].join(',')

const MAX_SIZE_MB = 20

export function FileUpload({ onUpload, disabled, isUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateAndUpload(file: File) {
    setError(null)
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_SIZE_MB} MB limit.`)
      return
    }
    onUpload(file).catch((err: unknown) => {
      setError((err as { message?: string })?.message ?? 'Upload failed.')
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndUpload(file)
    // reset input so the same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndUpload(file)
  }

  return (
    <div>
      <div
        className={[
          'relative flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-4 py-6 text-sm transition-colors cursor-pointer',
          dragOver ? 'border-(--ui-button-bg) bg-[var(--ui-button-bg)]/10' : 'border-(--ui-border)',
          disabled || isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <Upload size={20} style={{ color: 'var(--ui-text-muted, var(--ui-text))' }} />
        <span style={{ color: 'var(--ui-text)' }}>
          {isUploading ? 'Uploading…' : 'Drop a file here or click to upload'}
        </span>
        <span className="text-xs" style={{ color: 'var(--ui-text-muted, var(--ui-text))' }}>
          PDF, Word, Excel, PowerPoint, images, CSV, ZIP — max {MAX_SIZE_MB} MB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
