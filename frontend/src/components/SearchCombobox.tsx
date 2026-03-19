import { useState, useRef, useEffect } from 'react'

type Option = {
  id: number
  label: string
  sublabel?: string
}

type Props = {
  options: Option[]
  value: Option | null
  onChange: (option: Option) => void
  onClear: () => void
  placeholder?: string
  label: string
  required?: boolean
  isLoading?: boolean
}

export function SearchCombobox({
  options,
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  label,
  required,
  isLoading,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : options

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative" ref={containerRef}>
        {value ? (
          /* Selected state */
          <div className="flex items-center gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] px-3 py-2 text-sm text-[var(--ui-text)]">
            <span className="flex-1">
              {value.label}
              {value.sublabel && (
                <span className="ml-1 text-[var(--ui-muted)]">({value.sublabel})</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => { onClear(); setQuery(''); setOpen(false) }}
              className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              Change
            </button>
          </div>
        ) : (
          /* Search input + dropdown */
          <>
            <input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
            />

            {open && (
              <ul className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] shadow-lg">
                {isLoading ? (
                  <li className="px-3 py-2 text-sm text-[var(--ui-muted)]">Loading…</li>
                ) : filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--ui-muted)]">No results.</li>
                ) : (
                  filtered.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                        onClick={() => {
                          onChange(opt)
                          setQuery('')
                          setOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                      >
                        {opt.label}
                        {opt.sublabel && (
                          <span className="ml-1 text-[var(--ui-muted)]">({opt.sublabel})</span>
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
