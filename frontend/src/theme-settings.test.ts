import { describe, expect, it } from 'vitest'
import { applyUiTheme, defaultTenantUiSettings, normalizeUiSettings } from './uiSettings'

describe('tenant UI settings helpers', () => {
  it('fills missing fields with defaults', () => {
    const normalized = normalizeUiSettings({ density: 'compact' })

    expect(normalized.theme_preset).toBe(defaultTenantUiSettings.theme_preset)
    expect(normalized.density).toBe('compact')
    expect(normalized.font_family).toBe(defaultTenantUiSettings.font_family)
  })

  it('applies css tokens to document root in light mode', () => {
    applyUiTheme('light', {
      ...defaultTenantUiSettings,
      primary_colour: '#1e3a8a',
      secondary_colour: '#334155',
      tertiary_colour: '#0f766e',
      accent_colour: '#1d4ed8',
      theme_preset: 'high_contrast',
    })

    const style = document.documentElement.style
    expect(style.getPropertyValue('--ui-accent')).not.toBe('')
    expect(style.getPropertyValue('--ui-surface')).not.toBe('')
    expect(style.getPropertyValue('--ui-tertiary')).not.toBe('')
    expect(style.getPropertyValue('--ui-accent')).not.toBe('#1d4ed8')
    expect(style.getPropertyValue('--ui-bg')).not.toBe('')
  })

  it('applies css tokens to document root in dark mode', () => {
    applyUiTheme('dark', defaultTenantUiSettings)

    const style = document.documentElement.style
    expect(style.getPropertyValue('--ui-bg')).toContain('linear-gradient')
    expect(style.getPropertyValue('--ui-panel-bg')).not.toBe('')
    expect(style.getPropertyValue('--ui-text')).toBe('#e5e7eb')
    expect(style.getPropertyValue('--ui-muted')).toBe('#94a3b8')
  })
})
