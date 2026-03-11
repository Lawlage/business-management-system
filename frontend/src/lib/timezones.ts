function parseGmtOffsetMinutes(offsetLabel: string): number {
  if (offsetLabel === 'GMT') return 0
  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? '0')
  return sign * (hours * 60 + minutes)
}

export function buildTimezoneOptions(): Array<{ value: string; label: string; offsetMinutes: number }> {
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [
          'Pacific/Auckland',
          'UTC',
          'Australia/Sydney',
          'Asia/Singapore',
          'Europe/London',
          'Europe/Berlin',
          'America/Los_Angeles',
          'America/Denver',
          'America/Chicago',
          'America/New_York',
        ]

  const now = new Date()

  const options = zones.map((zone) => {
    let offsetLabel = 'GMT'
    try {
      const formatter = new Intl.DateTimeFormat('en-NZ', {
        timeZone: zone,
        timeZoneName: 'shortOffset',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      offsetLabel =
        formatter.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    } catch {
      offsetLabel = 'GMT'
    }

    const normalizedOffset =
      offsetLabel.includes(':') || offsetLabel === 'GMT'
        ? offsetLabel
        : offsetLabel.replace(/^(GMT[+-]\d{1,2})$/, '$1:00')

    return {
      value: zone,
      label: `(GMT${normalizedOffset.replace('GMT', '') || '+00:00'}) ${zone}`,
      offsetMinutes: parseGmtOffsetMinutes(normalizedOffset),
    }
  })

  return options.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes
    return a.value.localeCompare(b.value)
  })
}

export const timezoneOptions = buildTimezoneOptions()

export function getRegion(tz: string): string {
  const slash = tz.indexOf('/')
  return slash === -1 ? 'Other' : tz.slice(0, slash)
}
