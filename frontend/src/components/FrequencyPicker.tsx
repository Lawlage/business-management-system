import { useState } from 'react'
import type { FrequencyValue } from '../types'

interface FrequencyPickerProps {
  value: FrequencyValue | null
  onChange: (v: FrequencyValue | null) => void
  disabled?: boolean
  showStartDate?: boolean
  /** @deprecated no longer used — day_of_month option has been removed */
  allowDayOfMonth?: boolean
}

const UNIT_OPTIONS = [
  { value: 'days', singular: 'Day', plural: 'Days' },
  { value: 'months', singular: 'Month', plural: 'Months' },
  { value: 'years', singular: 'Year', plural: 'Years' },
]

const VALID_TYPES = new Set(['days', 'months', 'years'])

const FIELD_CLS =
  'rounded-md border border-[var(--ui-border)] px-3 py-2 text-sm app-panel focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60'

export default function FrequencyPicker({
  value,
  onChange,
  disabled = false,
  showStartDate = false,
}: FrequencyPickerProps) {
  // Only expose the three supported types; treat day_of_month / unknown as null
  const displayType = value?.type && VALID_TYPES.has(value.type) ? value.type : null

  const [inputText, setInputText] = useState<string>(String(value?.value ?? 1))
  const [lastValid, setLastValid] = useState<number>(value?.value ?? 1)

  // Sync when value changes externally (e.g. product selected in parent)
  const [prevValue, setPrevValue] = useState(value?.value)
  if (value?.value !== prevValue) {
    setPrevValue(value?.value)
    if (value?.value != null) {
      setInputText(String(value.value))
      setLastValid(value.value)
    }
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const unit = e.target.value
    if (!unit) {
      onChange(null)
      return
    }
    const num = lastValid
    const today = new Date().toISOString().split('T')[0]
    onChange({
      type: unit as FrequencyValue['type'],
      value: num,
      startDate: showStartDate ? (value?.startDate ?? today) : undefined,
    })
    setInputText(String(num))
  }

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setInputText(raw)
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num >= 1 && value) {
      setLastValid(num)
      onChange({ ...value, value: num })
    }
  }

  function handleInputBlur() {
    const num = parseInt(inputText, 10)
    if (isNaN(num) || num < 1) {
      setInputText(String(lastValid))
      if (value) onChange({ ...value, value: lastValid })
    } else {
      setLastValid(num)
      setInputText(String(num))
    }
  }

  function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!value) return
    onChange({ ...value, startDate: e.target.value || undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayType !== null && (
        <span className="text-sm" style={{ color: 'var(--ui-text)' }}>
          Every
        </span>
      )}

      {displayType !== null && (
        <input
          type="number"
          className={`${FIELD_CLS} w-20 text-center`}
          value={inputText}
          min={1}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          disabled={disabled}
          aria-label="Frequency value"
        />
      )}

      <select
        className={FIELD_CLS}
        value={displayType ?? ''}
        onChange={handleUnitChange}
        disabled={disabled}
      >
        <option value="">None</option>
        {UNIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {lastValid === 1 ? opt.singular : opt.plural}
          </option>
        ))}
      </select>

      {showStartDate && displayType !== null && (
        <>
          <span className="text-sm text-[var(--ui-muted)]">starting from</span>
          <input
            type="date"
            className={FIELD_CLS}
            value={value?.startDate ?? ''}
            onChange={handleStartDateChange}
            disabled={disabled}
            aria-label="Start date"
          />
        </>
      )}
    </div>
  )
}
