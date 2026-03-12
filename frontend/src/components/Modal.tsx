import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  title: string
  onClose: () => void
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  children: ReactNode
  footer?: ReactNode
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Modal({
  title,
  onClose,
  maxWidth = '2xl',
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const backdropMouseDownRef = useRef(false)

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Focus first focusable element
  useEffect(() => {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable && focusable.length > 0) {
      focusable[0].focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target === e.currentTarget }}
      onClick={(e) => { if (backdropMouseDownRef.current && e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxWidthMap[maxWidth]} rounded-xl border border-[var(--ui-border)] app-panel p-4 shadow-2xl`}
        style={{ animation: 'modalIn 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 id="modal-title" className="text-base font-semibold text-[var(--ui-text)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--ui-muted)] transition hover:text-[var(--ui-text)] hover:bg-[var(--ui-inner-bg)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-4 border-t border-[var(--ui-border)] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
