import { useState } from 'react'
import { timezoneOptions } from '../lib/timezones'

type TimezoneSelectProps = {
  value: string
  onChange: (value: string) => void
  label?: string
}

export function TimezoneSelect({ value, onChange, label }: TimezoneSelectProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filtered = search.trim()
    ? timezoneOptions.filter(
        (tz) =>
          tz.value.toLowerCase().includes(search.toLowerCase()) ||
          tz.label.toLowerCase().includes(search.toLowerCase()),
      )
    : timezoneOptions

  function handleSelect(tzValue: string) {
    onChange(tzValue)
    setSearch('')
    setIsOpen(false)
  }

  function handleInputFocus() {
    setIsOpen(true)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    setIsOpen(true)
  }

  function handleBlur() {
    // Delay so option click fires before the dropdown closes
    window.setTimeout(() => {
      setIsOpen(false)
      setSearch('')
    }, 150)
  }

  const displayValue = isOpen ? search : value

  return (
    <div className="relative" onBlur={handleBlur}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
          {label}
        </label>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder="Search timezone..."
        className="w-full rounded-md border border-[var(--ui-border)] px-3 py-2 text-sm app-panel focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
      />
      {isOpen && (
        <div className="absolute z-10 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--ui-border)] app-panel shadow-xl mt-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--ui-muted)]">No results</p>
          ) : (
            filtered.map((tz) => (
              <button
                key={tz.value}
                type="button"
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--ui-inner-bg)] transition ${
                  tz.value === value ? 'text-[var(--ui-accent)] font-medium' : 'text-[var(--ui-text)]'
                }`}
                onMouseDown={(e) => {
                  // Prevent blur from firing before click registers
                  e.preventDefault()
                }}
                onClick={() => handleSelect(tz.value)}
              >
                {tz.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
