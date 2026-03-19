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
  label?: string
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

  // Close dropdown when clicking outside; reset query so input reverts to selected label
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // When open, input shows the live query; when closed, it shows the selected label (or empty)
  const inputValue = open ? query : (value?.label ?? '')

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative" ref={containerRef}>
        <div className="flex items-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] focus-within:ring-2 focus-within:ring-[var(--ui-accent)]/60">
          <input
            type="text"
            placeholder={value ? value.label : placeholder}
            value={inputValue}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!open) setOpen(true)
            }}
            onFocus={() => {
              setQuery('')
              setOpen(true)
            }}
            onClick={() => {
              setQuery('')
              setOpen(true)
            }}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onClear(); setQuery(''); setOpen(false) }}
              className="pr-2 text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

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
      </div>
    </div>
  )
}
