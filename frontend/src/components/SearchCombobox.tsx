import { useState, useRef, useEffect, useCallback } from 'react'

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : options

  // Reset highlighted index when filtered list changes or dropdown opens/closes
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filtered.length, open])

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>('[data-combobox-option]')
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setOpen(true)
          e.preventDefault()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : prev,
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            onChange(filtered[highlightedIndex])
            setQuery('')
            setOpen(false)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          setQuery('')
          break
      }
    },
    [open, filtered, highlightedIndex, onChange],
  )

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
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={
              highlightedIndex >= 0 ? `combobox-option-${highlightedIndex}` : undefined
            }
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
          <ul
            ref={listRef}
            role="listbox"
            className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] shadow-lg"
          >
            {isLoading ? (
              <li className="px-3 py-2 text-sm text-[var(--ui-muted)]">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--ui-muted)]">No results.</li>
            ) : (
              filtered.map((opt, idx) => (
                <li key={opt.id} data-combobox-option>
                  <button
                    type="button"
                    id={`combobox-option-${idx}`}
                    role="option"
                    aria-selected={highlightedIndex === idx}
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => {
                      onChange(opt)
                      setQuery('')
                      setOpen(false)
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={[
                      'w-full px-3 py-2 text-left text-sm text-[var(--ui-text)] transition',
                      highlightedIndex === idx
                        ? 'bg-[var(--ui-accent)]/15 text-[var(--ui-accent)]'
                        : 'hover:bg-[var(--ui-border)]',
                    ].join(' ')}
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
