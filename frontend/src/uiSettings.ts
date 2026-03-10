export type ThemePreset = 'default' | 'high_contrast' | 'colour_blind_safe'
export type DensityMode = 'comfortable' | 'compact'
export type FontFamilyMode = 'serif_system' | 'modern_sans' | 'humanist'

export type TenantUiSettings = {
  theme_preset: ThemePreset
  density: DensityMode
  font_family: FontFamilyMode
  primary_colour: string
  secondary_colour: string
  tertiary_colour: string
  accent_colour: string
  border_colour: string
}

export const defaultTenantUiSettings: TenantUiSettings = {
  theme_preset: 'default',
  density: 'comfortable',
  font_family: 'modern_sans',
  primary_colour: '#0f172a',
  secondary_colour: '#1e293b',
  tertiary_colour: '#4b5563',
  accent_colour: '#4b5563',
  border_colour: '#5f738a',
}

export const defaultTenantColourSet = {
  primary_colour: defaultTenantUiSettings.primary_colour,
  secondary_colour: defaultTenantUiSettings.secondary_colour,
  tertiary_colour: defaultTenantUiSettings.tertiary_colour,
  accent_colour: defaultTenantUiSettings.accent_colour,
  border_colour: defaultTenantUiSettings.border_colour,
}

export const themePresetOptions: Array<{ value: ThemePreset; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'high_contrast', label: 'High Contrast' },
  { value: 'colour_blind_safe', label: 'Colour Blind Safe' },
]

export const densityOptions: Array<{ value: DensityMode; label: string }> = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

export const fontFamilyOptions: Array<{ value: FontFamilyMode; label: string }> = [
  { value: 'serif_system', label: 'Serif System' },
  { value: 'modern_sans', label: 'Blocky Sans' },
  { value: 'humanist', label: 'Humanist Sans' },
]

export function normalizeUiSettings(value?: Partial<TenantUiSettings> | null): TenantUiSettings {
  const legacy = (value ?? {}) as Record<string, string>

  const normalizedTertiary = (value?.tertiary_colour ?? legacy.tertiary_color ?? legacy.primary_color ?? defaultTenantUiSettings.tertiary_colour)
  const migratedTertiary = normalizedTertiary.toLowerCase() === '#0b5cab' ? defaultTenantUiSettings.tertiary_colour : normalizedTertiary

  return {
    ...defaultTenantUiSettings,
    ...(value ?? {}),
    primary_colour: (value?.primary_colour ?? legacy.primary_color ?? defaultTenantUiSettings.primary_colour),
    secondary_colour: (value?.secondary_colour ?? legacy.secondary_color ?? legacy.neutral_color ?? defaultTenantUiSettings.secondary_colour),
    tertiary_colour: migratedTertiary,
    accent_colour: migratedTertiary,
    border_colour: (value?.border_colour ?? legacy.border_color ?? legacy.neutral_color ?? defaultTenantUiSettings.border_colour),
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized

  const int = Number.parseInt(value, 16)
  if (Number.isNaN(int)) {
    return { r: 0, g: 0, b: 0 }
  }

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  const asHex = (value: number) => clamp(value).toString(16).padStart(2, '0')
  return `#${asHex(r)}${asHex(g)}${asHex(b)}`
}

function mixHex(base: string, other: string, ratio: number): string {
  const amount = Math.max(0, Math.min(1, ratio))
  const first = hexToRgb(base)
  const second = hexToRgb(other)

  return rgbToHex({
    r: first.r * (1 - amount) + second.r * amount,
    g: first.g * (1 - amount) + second.g * amount,
    b: first.b * (1 - amount) + second.b * amount,
  })
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const toLinear = (channel: number) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function applyUiTheme(theme: 'dark' | 'light', settings: TenantUiSettings): void {
  const rootStyle = document.documentElement.style
  const fontFamilyMap: Record<FontFamilyMode, string> = {
    serif_system: '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif',
    modern_sans: '"Bahnschrift", "Arial Narrow", "Franklin Gothic Medium", "Segoe UI", sans-serif',
    humanist: '"Source Sans 3", "Gill Sans", "Trebuchet MS", sans-serif',
  }

  const presetMap: Record<
    ThemePreset,
    {
      light: Record<string, string>
      dark: Record<string, string>
      palette: {
        primary: string
        secondary: string
        tertiary: string
        accent: string
      }
      tone: {
        darkBaseMix: number
        lightBaseMix: number
        panelTint: number
        innerTint: number
        borderContrast: number
      }
    }
  > = {
    default: {
      light: {
        '--ui-text': '#1f2937',
        '--ui-muted': '#475569',
      },
      dark: {
        '--ui-text': '#e5e7eb',
        '--ui-muted': '#94a3b8',
      },
      palette: {
        primary: settings.primary_colour,
        secondary: settings.secondary_colour,
        tertiary: settings.tertiary_colour,
        accent: settings.accent_colour,
      },
      tone: {
        darkBaseMix: 62,
        lightBaseMix: 36,
        panelTint: 16,
        innerTint: 14,
        borderContrast: 42,
      },
    },
    high_contrast: {
      light: {
        '--ui-text': '#0a0a0a',
        '--ui-muted': '#1f2937',
      },
      dark: {
        '--ui-text': '#ffffff',
        '--ui-muted': '#e5e7eb',
      },
      palette: {
        primary: '#000000',
        secondary: '#111827',
        tertiary: '#facc15',
        accent: '#22d3ee',
      },
      tone: {
        darkBaseMix: 92,
        lightBaseMix: 84,
        panelTint: 2,
        innerTint: 2,
        borderContrast: 86,
      },
    },
    colour_blind_safe: {
      light: {
        '--ui-text': '#0b132b',
        '--ui-muted': '#243b53',
      },
      dark: {
        '--ui-text': '#f8fafc',
        '--ui-muted': '#bfdbfe',
      },
      palette: {
        primary: '#0b132b',
        secondary: '#1c2541',
        tertiary: '#0072b2',
        accent: '#e69f00',
      },
      tone: {
        darkBaseMix: 76,
        lightBaseMix: 62,
        panelTint: 12,
        innerTint: 10,
        borderContrast: 64,
      },
    },
  }

  const preset = presetMap[settings.theme_preset]
  const activePreset = preset[theme]
  Object.entries(activePreset).forEach(([token, tokenValue]) => {
    rootStyle.setProperty(token, tokenValue)
  })

  const tone = preset.tone
  const darkMix = tone.darkBaseMix
  const panelTint = tone.panelTint
  const innerTint = tone.innerTint
  const borderContrast = tone.borderContrast
  const isDark = theme === 'dark'

  const adjustedPrimary = isDark
    ? mixHex(preset.palette.primary, '#020617', 0.48)
    : mixHex(preset.palette.primary, '#ffffff', 0.92)
  const adjustedSecondary = isDark
    ? mixHex(preset.palette.secondary, '#0f172a', 0.32)
    : mixHex(preset.palette.secondary, '#ffffff', 0.82)
  const adjustedTertiary = isDark
    ? mixHex(preset.palette.tertiary, '#e2e8f0', 0.18)
    : mixHex(preset.palette.tertiary, '#0f172a', 0.12)
  const adjustedAccent = isDark
    ? mixHex(preset.palette.accent, '#dbeafe', 0.12)
    : mixHex(preset.palette.accent, '#0f172a', 0.06)
  const adjustedBorder = isDark
    ? mixHex(settings.border_colour, '#cbd5e1', 0.12)
    : mixHex(settings.border_colour, '#1e293b', 0.16)
  const buttonText = relativeLuminance(adjustedTertiary) > 0.42 ? '#0f172a' : '#f8fafc'

  rootStyle.setProperty('--ui-bg', isDark
    ? `linear-gradient(145deg, color-mix(in oklab, ${adjustedPrimary} ${darkMix}%, #020617 ${100 - darkMix}%) 0%, color-mix(in oklab, ${adjustedPrimary} ${Math.max(40, darkMix - 10)}%, #020617 ${Math.min(60, 100 - (darkMix - 10))}%) 100%)`
    : `linear-gradient(145deg, color-mix(in oklab, ${adjustedPrimary} 8%, #ffffff 92%) 0%, color-mix(in oklab, ${adjustedPrimary} 16%, #f8fafc 84%) 100%)`)
  rootStyle.setProperty('--ui-surface', adjustedSecondary)
  rootStyle.setProperty('--ui-surface-elevated', isDark
    ? `color-mix(in oklab, ${adjustedSecondary} ${Math.max(72, 94 - panelTint)}%, #1e293b ${Math.min(28, panelTint)}%)`
    : `color-mix(in oklab, ${adjustedSecondary} ${Math.max(70, 96 - panelTint)}%, #ffffff ${Math.min(30, panelTint)}%)`)
  rootStyle.setProperty('--ui-tertiary', adjustedTertiary)
  rootStyle.setProperty('--ui-accent', adjustedAccent)
  rootStyle.setProperty('--ui-border', adjustedBorder)
  rootStyle.setProperty('--ui-neutral', `color-mix(in oklab, ${adjustedSecondary} ${Math.max(40, 100 - borderContrast)}%, ${adjustedAccent} ${borderContrast}%)`)
  rootStyle.setProperty('--ui-panel-bg', isDark
    ? `color-mix(in oklab, ${adjustedSecondary} ${Math.max(72, 94 - panelTint)}%, #1e293b ${Math.min(28, panelTint)}%)`
    : `color-mix(in oklab, ${adjustedSecondary} 26%, #ffffff 74%)`)
  rootStyle.setProperty('--ui-inner-bg', isDark
    ? `color-mix(in oklab, ${adjustedSecondary} ${Math.max(62, 88 - innerTint)}%, ${adjustedAccent} ${Math.min(38, innerTint + 8)}%)`
    : `color-mix(in oklab, ${adjustedSecondary} 52%, #ffffff 30%, ${adjustedAccent} 18%)`)
  rootStyle.setProperty('--ui-button-bg', isDark
    ? `color-mix(in oklab, ${adjustedTertiary} 82%, #0b1220 18%)`
    : adjustedTertiary)
  rootStyle.setProperty('--ui-button-fg', buttonText)
  rootStyle.setProperty('--ui-font-family', fontFamilyMap[settings.font_family])
  rootStyle.setProperty('--ui-density-gap', settings.density === 'compact' ? '0.5rem' : '1rem')
  rootStyle.setProperty('--ui-density-pad', settings.density === 'compact' ? '0.625rem' : '0.9rem')
}
