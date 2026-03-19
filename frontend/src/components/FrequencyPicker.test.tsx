import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FrequencyPicker from './FrequencyPicker'
import type { FrequencyValue } from '../types'

describe('FrequencyPicker', () => {
  // ── Default render ─────────────────────────────────────────────────────────

  it('renders "None" option selected when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('does not render the number input when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Frequency value')).toBeNull()
  })

  it('does not render "Every" text when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    expect(screen.queryByText('Every')).toBeNull()
  })

  // ── When a unit is selected ────────────────────────────────────────────────

  it('shows "Every", number input, and dropdown when a unit is set', () => {
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} />)
    expect(screen.getByText('Every')).toBeTruthy()
    expect(screen.getByLabelText('Frequency value')).toBeTruthy()
    expect(screen.getByRole('combobox')).toHaveValue('months')
  })

  it('includes days, months, years options', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(options).toContain('days')
    expect(options).toContain('months')
    expect(options).toContain('years')
  })

  it('uses singular labels when value is 1', () => {
    const value: FrequencyValue = { type: 'months', value: 1 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} />)
    const labels = screen.getAllByRole('option').map((o) => o.textContent)
    expect(labels).toContain('Day')
    expect(labels).toContain('Month')
    expect(labels).toContain('Year')
  })

  it('uses plural labels when value is greater than 1', () => {
    const value: FrequencyValue = { type: 'months', value: 3 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} />)
    const labels = screen.getAllByRole('option').map((o) => o.textContent)
    expect(labels).toContain('Days')
    expect(labels).toContain('Months')
    expect(labels).toContain('Years')
  })

  it('does not include day_of_month option', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(options).not.toContain('day_of_month')
  })

  // ── Date picker (showStartDate prop) ───────────────────────────────────────

  it('does not render a date picker by default', () => {
    const value: FrequencyValue = { type: 'months', value: 12 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Start date')).toBeNull()
  })

  it('renders a date picker when showStartDate=true and a unit is set', () => {
    const value: FrequencyValue = { type: 'months', value: 3, startDate: '2024-01-01' }
    render(<FrequencyPicker value={value} onChange={vi.fn()} showStartDate />)
    expect(screen.getByLabelText('Start date')).toBeTruthy()
  })

  it('does not render date picker when showStartDate=true but value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} showStartDate />)
    expect(screen.queryByLabelText('Start date')).toBeNull()
  })

  // ── day_of_month legacy data treated as None ───────────────────────────────

  it('treats day_of_month type as None in dropdown', () => {
    const value: FrequencyValue = { type: 'day_of_month', value: 15 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(screen.queryByLabelText('Frequency value')).toBeNull()
  })

  // ── onChange callback shape ────────────────────────────────────────────────

  it('calls onChange with null when type is cleared to None', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with correct shape when type is selected', () => {
    const onChange = vi.fn()
    render(<FrequencyPicker value={null} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'months' } })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'months', value: 1 }),
    )
  })

  it('calls onChange with updated value when number input changes', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Frequency value'), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'months', value: 12 }))
  })

  it('calls onChange with updated startDate when date input changes', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'years', value: 1 }
    render(<FrequencyPicker value={value} onChange={onChange} showStartDate />)

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-06-01' } })
    expect(onChange).toHaveBeenCalledWith({ type: 'years', value: 1, startDate: '2025-06-01' })
  })

  // ── Number input: focus selects, blur reverts if empty ────────────────────

  it('reverts to last valid value when blurred with empty input', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    const input = screen.getByLabelText('Frequency value')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as FrequencyValue
    expect(lastCall.value).toBe(6)
  })

  it('does not fire onChange when input is temporarily empty (before blur)', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Frequency value'), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  // ── Disabled state ─────────────────────────────────────────────────────────

  it('disables all inputs when disabled=true', () => {
    const value: FrequencyValue = { type: 'months', value: 3 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} disabled={true} showStartDate />)

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByLabelText('Frequency value')).toBeDisabled()
    expect(screen.getByLabelText('Start date')).toBeDisabled()
  })
})
