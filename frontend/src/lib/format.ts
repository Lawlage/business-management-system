import { renewalCategoryOptions } from '../types'

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
  const option = renewalCategoryOptions.find((entry) => entry.value === value)
  if (option) return option.label
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
