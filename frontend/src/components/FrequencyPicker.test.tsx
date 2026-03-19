import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FrequencyPicker from './FrequencyPicker'
import type { FrequencyValue } from '../types'

describe('FrequencyPicker', () => {
  // ── Default render ─────────────────────────────────────────────────────────

  it('renders "None" option selected when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('')
  })

  it('does not render the number input when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Frequency value')).toBeNull()
  })

  it('does not render the date picker when value is null', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Start date')).toBeNull()
  })

  // ── allowDayOfMonth = false (product form) ─────────────────────────────────

  it('does not include day_of_month option when allowDayOfMonth is false', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} allowDayOfMonth={false} />)
    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(options).not.toContain('day_of_month')
  })

  it('includes days, months, years options when allowDayOfMonth is false', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} allowDayOfMonth={false} />)
    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(options).toContain('days')
    expect(options).toContain('months')
    expect(options).toContain('years')
  })

  it('does not show date picker even for days type when allowDayOfMonth is false', () => {
    // allowDayOfMonth=false still shows date picker for days/months/years because
    // showDatePicker = value !== null && value.type !== 'day_of_month'
    // (the product form doesn't use startDate but the picker still appears)
    const value: FrequencyValue = { type: 'months', value: 12 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} allowDayOfMonth={false} />)
    // Date picker IS shown for months type (not day_of_month)
    expect(screen.getByLabelText('Start date')).toBeTruthy()
  })

  // ── allowDayOfMonth = true (renewable form) ────────────────────────────────

  it('includes day_of_month option when allowDayOfMonth is true', () => {
    render(<FrequencyPicker value={null} onChange={vi.fn()} allowDayOfMonth={true} />)
    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(options).toContain('day_of_month')
  })

  it('does not show date picker when type is day_of_month', () => {
    const value: FrequencyValue = { type: 'day_of_month', value: 15 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} allowDayOfMonth={true} />)
    expect(screen.queryByLabelText('Start date')).toBeNull()
  })

  it('shows date picker when type is months', () => {
    const value: FrequencyValue = { type: 'months', value: 3, startDate: '2024-01-01' }
    render(<FrequencyPicker value={value} onChange={vi.fn()} allowDayOfMonth={true} />)
    expect(screen.getByLabelText('Start date')).toBeTruthy()
  })

  it('shows date picker when type is years', () => {
    const value: FrequencyValue = { type: 'years', value: 1 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} allowDayOfMonth={true} />)
    expect(screen.getByLabelText('Start date')).toBeTruthy()
  })

  it('shows date picker when type is days', () => {
    const value: FrequencyValue = { type: 'days', value: 30 }
    render(<FrequencyPicker value={value} onChange={vi.fn()} allowDayOfMonth={true} />)
    expect(screen.getByLabelText('Start date')).toBeTruthy()
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

  it('calls onChange with day_of_month shape (no startDate)', () => {
    const onChange = vi.fn()
    render(<FrequencyPicker value={null} onChange={onChange} allowDayOfMonth={true} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'day_of_month' } })

    const called = onChange.mock.calls[0][0] as FrequencyValue
    expect(called.type).toBe('day_of_month')
    expect(called.value).toBe(1)
    expect(called).not.toHaveProperty('startDate')
  })

  it('calls onChange with updated value when number input changes', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'months', value: 6 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Frequency value'), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith({ type: 'months', value: 12, startDate: undefined })
  })

  it('calls onChange with updated startDate when date input changes', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'years', value: 1 }
    render(<FrequencyPicker value={value} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-06-01' } })
    expect(onChange).toHaveBeenCalledWith({ type: 'years', value: 1, startDate: '2025-06-01' })
  })

  // ── Number input constraints ───────────────────────────────────────────────

  it('clamps day_of_month value to max 31', () => {
    const onChange = vi.fn()
    const value: FrequencyValue = { type: 'day_of_month', value: 15 }
    render(<FrequencyPicker value={value} onChange={onChange} allowDayOfMonth={true} />)

    fireEvent.change(screen.getByLabelText('Frequency value'), { target: { value: '99' } })
    const called = onChange.mock.calls[0][0] as FrequencyValue
    expect(called.value).toBe(31)
  })

  // ── Disabled state ─────────────────────────────────────────────────────────

  it('disables all inputs when disabled=true', () => {
    const value: FrequencyValue = { type: 'months', value: 3, startDate: '2024-01-01' }
    render(<FrequencyPicker value={value} onChange={vi.fn()} disabled={true} />)

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByLabelText('Frequency value')).toBeDisabled()
    expect(screen.getByLabelText('Start date')).toBeDisabled()
  })
})
