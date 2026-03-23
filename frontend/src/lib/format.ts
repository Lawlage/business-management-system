import { renewableCategoryOptions } from '../types'

export function formatDateTime(value?: string | null, timezone = 'UTC'): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date)
}

export function formatDate(value?: string | null, timezone = 'UTC'): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(date)
}

export function formatRenewalCategory(value?: string | null): string {
  if (!value) return 'Uncategorized'
  const option = renewableCategoryOptions.find((entry) => entry.value === value)
  if (option) return option.label
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatFrequency(
  type?: 'days' | 'months' | 'years' | 'day_of_month' | null,
  value?: number | null,
): string {
  if (!type || value == null) return 'Non-expiring'
  if (type === 'day_of_month') return `Day ${value} of each month`
  return `Every ${value} ${type}`
}

export function formatAuditEvent(event?: string): string {
  if (!event) return 'Unknown event'
  return event
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Return a human-friendly relative time string ("2 days ago", "in 3 hours").
 * Falls back to formatDate() for dates older than 30 days.
 */
export function formatRelativeDate(value?: string | null, timezone = 'UTC'): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const absDiffMs = Math.abs(diffMs)
  const isPast = diffMs > 0

  const minutes = Math.floor(absDiffMs / 60_000)
  const hours = Math.floor(absDiffMs / 3_600_000)
  const days = Math.floor(absDiffMs / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`
  if (days <= 30) return isPast ? `${days}d ago` : `in ${days}d`

  return formatDate(value, timezone)
}

/**
 * Format a number as currency using Intl.NumberFormat.
 * Defaults to NZD (since tenant locale is NZ-based).
 */
export function formatCurrency(
  amount: number | string,
  currency = 'NZD',
  locale = 'en-NZ',
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(num)) return '$0.00'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}
