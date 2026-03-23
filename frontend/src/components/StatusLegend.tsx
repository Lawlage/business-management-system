import { useState } from 'react'
import { Info } from 'lucide-react'
import { Badge } from './Badge'

type StatusLegendProps = {
  statuses: string[]
}

export function StatusLegend({ statuses }: StatusLegendProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition"
        title="Status legend"
      >
        <Info size={13} />
        <span className="hidden sm:inline">Legend</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-30 min-w-[180px] rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] p-3 shadow-lg space-y-1.5">
            {statuses.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <Badge status={status} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
