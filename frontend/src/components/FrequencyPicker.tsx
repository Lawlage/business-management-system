import type { FrequencyValue } from '../types'

interface FrequencyPickerProps {
  value: FrequencyValue | null
  onChange: (v: FrequencyValue | null) => void
  disabled?: boolean
  allowDayOfMonth?: boolean
}

const TYPE_OPTIONS_BASE = [
  { value: 'days', label: 'Every X days' },
  { value: 'months', label: 'Every X months' },
  { value: 'years', label: 'Every X years' },
]

const TYPE_OPTIONS_FULL = [
  ...TYPE_OPTIONS_BASE,
  { value: 'day_of_month', label: 'Day X of each month' },
]

export default function FrequencyPicker({
  value,
  onChange,
  disabled = false,
  allowDayOfMonth = false,
}: FrequencyPickerProps) {
  const typeOptions = allowDayOfMonth ? TYPE_OPTIONS_FULL : TYPE_OPTIONS_BASE
  const showDatePicker = value !== null && value.type !== 'day_of_month'
  const isDayOfMonth = value?.type === 'day_of_month'

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newType = e.target.value
    if (!newType) {
      onChange(null)
      return
    }
    const currentValue = value?.value ?? 1
    if (newType === 'day_of_month') {
      onChange({ type: 'day_of_month', value: Math.min(currentValue, 31) })
    } else {
      onChange({
        type: newType as FrequencyValue['type'],
        value: currentValue,
        startDate: value?.startDate,
      })
    }
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!value) return
    const num = parseInt(e.target.value, 10)
    if (isNaN(num)) return
    const clamped = isDayOfMonth ? Math.min(Math.max(num, 1), 31) : Math.max(num, 1)
    onChange({ ...value, value: clamped })
  }

  function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!value) return
    onChange({ ...value, startDate: e.target.value || undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="input-base"
        value={value?.type ?? ''}
        onChange={handleTypeChange}
        disabled={disabled}
      >
        <option value="">None</option>
        {typeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {value !== null && (
        <input
          type="number"
          className="input-base w-20"
          value={value.value}
          min={1}
          max={isDayOfMonth ? 31 : undefined}
          onChange={handleValueChange}
          disabled={disabled}
          aria-label="Frequency value"
        />
      )}

      {showDatePicker && (
        <>
          <span className="text-sm text-[var(--color-muted)]">starting from</span>
          <input
            type="date"
            className="input-base"
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
