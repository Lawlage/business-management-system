import { useRef, useState } from 'react'

type Props = {
  id?: string
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  error?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

/**
 * Whole-number input with clear-on-focus UX.
 * - On focus: if value is 0, clears so the user can type from scratch.
 * - On blur: if the field is empty or invalid, resets to 0 (or min if provided).
 * - Backspace/delete can clear the field entirely; defaults on blur.
 */
export function NumberInput({ id, label, value, onChange, min, max, error, disabled, className, required }: Props) {
  const [rawValue, setRawValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = rawValue !== null ? rawValue : String(value)

  function handleFocus() {
    if (value === 0) {
      setRawValue('')
    } else {
      setRawValue(String(value))
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    // Allow empty string or digits only
    if (v === '' || /^\d+$/.test(v)) {
      setRawValue(v)
    }
  }

  function handleBlur() {
    const raw = rawValue ?? String(value)
    const num = parseInt(raw, 10)
    const defaultVal = min !== undefined ? min : 0
    const finalValue = isNaN(num) || raw.trim() === '' ? defaultVal : num
    const clamped =
      min !== undefined && finalValue < min
        ? min
        : max !== undefined && finalValue > max
          ? max
          : finalValue
    setRawValue(null)
    onChange(clamped)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
    if (!/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={[
          'w-full px-3 py-2 rounded border text-sm',
          error
            ? 'border-red-500'
            : 'border-(--ui-border) focus:border-(--ui-button-bg)',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
