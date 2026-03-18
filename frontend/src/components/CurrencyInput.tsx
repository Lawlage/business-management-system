import { useRef, useState } from 'react'

type Props = {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

/**
 * Currency input showing a $ prefix inside the field.
 * - On focus: if value is $0.00 or empty, clears the input so the user can
 *   type from scratch without needing to delete the placeholder.
 * - On blur: if the field is empty or invalid, resets to "0.00".
 * - Supports full backspace/delete — the field goes blank, then defaults on blur.
 */
export function CurrencyInput({ id, label, value, onChange, error, disabled, className }: Props) {
  // Track the raw string the user is typing (may be blank during editing)
  const [rawValue, setRawValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = rawValue !== null ? rawValue : formatForDisplay(value)

  function formatForDisplay(v: string): string {
    const num = parseFloat(v)
    if (isNaN(num)) return '0.00'
    return num.toFixed(2)
  }

  function handleFocus() {
    const num = parseFloat(value)
    // If value is zero (or empty), clear so user can type from scratch
    if (!value || num === 0) {
      setRawValue('')
    } else {
      setRawValue(formatForDisplay(value))
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow digits, a single decimal point, and empty string
    const v = e.target.value
    if (/^(\d+\.?\d{0,2})?$/.test(v)) {
      setRawValue(v)
    }
  }

  function handleBlur() {
    const raw = rawValue ?? value
    const num = parseFloat(raw)
    const finalValue = isNaN(num) || raw.trim() === '' ? '0.00' : num.toFixed(2)
    setRawValue(null)
    onChange(finalValue)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow all standard editing keys
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Tab' ||
      e.key === 'Enter'
    ) {
      return
    }
    // Block non-numeric except decimal point
    if (!/[\d.]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none"
          style={{ color: 'var(--ui-text-muted, var(--ui-text))' }}
        >
          $
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={[
            'w-full pl-7 pr-3 py-2 rounded border text-sm',
            error
              ? 'border-red-500'
              : 'border-(--ui-border) focus:border-(--ui-button-bg)',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
