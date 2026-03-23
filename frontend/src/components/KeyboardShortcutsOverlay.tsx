import { useEffect, useState } from 'react'

const shortcuts = [
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
  { keys: ['/'], description: 'Focus search field' },
]

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--ui-border)] app-panel shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--ui-text)] mb-4">Keyboard Shortcuts</h3>
        <ul className="space-y-2">
          {shortcuts.map((s) => (
            <li key={s.keys.join('+')} className="flex items-center justify-between text-sm">
              <span className="text-[var(--ui-text)]">{s.description}</span>
              <span className="flex gap-1">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex items-center rounded border border-[var(--ui-border)] bg-[var(--ui-inner-bg)] px-1.5 py-0.5 text-xs font-mono text-[var(--ui-muted)]"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--ui-muted)]">
          Press <kbd className="rounded border border-[var(--ui-border)] px-1 text-xs font-mono">?</kbd> again or <kbd className="rounded border border-[var(--ui-border)] px-1 text-xs font-mono">Esc</kbd> to close.
        </p>
      </div>
    </div>
  )
}
