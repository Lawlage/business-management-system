import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConfirmContext } from '../contexts/ConfirmContext'
import { Button } from './Button'

export function ConfirmDialog() {
  const { pending, resolve } = useConfirmContext()

  useEffect(() => {
    if (!pending) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') resolve(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pending, resolve])

  if (!pending) return null

  const isDanger = pending.variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => resolve(false)}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--ui-border)] app-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="mb-3 flex items-start gap-3">
          <span className={isDanger ? 'text-red-400' : 'text-amber-400'}>
            <AlertTriangle size={20} />
          </span>
          <h3
            className={`text-sm font-semibold ${isDanger ? 'text-red-300' : 'text-[var(--ui-text)]'}`}
          >
            {pending.title}
          </h3>
        </div>

        {/* Message */}
        <p className="mb-5 pl-8 text-sm text-[var(--ui-muted)]">{pending.message}</p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => resolve(false)}>
            Cancel
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => resolve(true)}
          >
            {pending.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
