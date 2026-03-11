import { useMutation } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useApi } from '../../../hooks/useApi'
import type { ApiError } from '../../../hooks/useApi'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { Select } from '../../../components/Select'
import { TimezoneSelect } from '../../../components/TimezoneSelect'
import {
  densityOptions,
  fontFamilyOptions,
  defaultTenantColourSet,
} from '../../../uiSettings'
import type { DensityMode, FontFamilyMode } from '../../../uiSettings'

export function TenantSettingsPage() {
  const {
    tenantTimezone,
    setTenantTimezone,
    tenantUiSettings,
    setTenantUiSettings,
  } = useTenant()
  const { showNotice } = useNotice()
  const { authedFetch } = useApi()

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify({
          timezone: tenantTimezone,
          ui_settings: tenantUiSettings,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Settings saved.')
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  function handleResetColours() {
    setTenantUiSettings({ ...tenantUiSettings, ...defaultTenantColourSet })
  }

  return (
    <Card>
      <PageHeader title="Tenant Settings" />

      <div className="space-y-6">
        {/* Timezone */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">Timezone</h3>
          <div className="max-w-sm">
            <TimezoneSelect
              value={tenantTimezone}
              onChange={setTenantTimezone}
              label="Timezone"
            />
          </div>
        </div>

        {/* Layout & Typography */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">
            Layout &amp; Typography
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Layout Density"
              value={tenantUiSettings.density}
              onChange={(e) =>
                setTenantUiSettings({
                  ...tenantUiSettings,
                  density: e.target.value as DensityMode,
                })
              }
            >
              {densityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select
              label="Typography"
              value={tenantUiSettings.font_family}
              onChange={(e) =>
                setTenantUiSettings({
                  ...tenantUiSettings,
                  font_family: e.target.value as FontFamilyMode,
                })
              }
            >
              {fontFamilyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Colour Settings */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ui-text)]">
            Colour Settings
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                Primary Colour (Background)
              </span>
              <input
                type="color"
                className="h-11 w-full rounded-md border border-[var(--ui-border)] px-3 py-2 app-panel"
                value={tenantUiSettings.primary_colour}
                onChange={(e) =>
                  setTenantUiSettings({
                    ...tenantUiSettings,
                    primary_colour: e.target.value,
                  })
                }
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                Secondary Colour (Containers)
              </span>
              <input
                type="color"
                className="h-11 w-full rounded-md border border-[var(--ui-border)] px-3 py-2 app-panel"
                value={tenantUiSettings.secondary_colour}
                onChange={(e) =>
                  setTenantUiSettings({
                    ...tenantUiSettings,
                    secondary_colour: e.target.value,
                  })
                }
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                Border Colour (Panels + Boxes)
              </span>
              <input
                type="color"
                className="h-11 w-full rounded-md border border-[var(--ui-border)] px-3 py-2 app-panel"
                value={tenantUiSettings.border_colour}
                onChange={(e) =>
                  setTenantUiSettings({
                    ...tenantUiSettings,
                    border_colour: e.target.value,
                  })
                }
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                Tertiary/Accent Colour (Clickable + Highlights)
              </span>
              <input
                type="color"
                className="h-11 w-full rounded-md border border-[var(--ui-border)] px-3 py-2 app-panel"
                value={tenantUiSettings.tertiary_colour}
                onChange={(e) =>
                  setTenantUiSettings({
                    ...tenantUiSettings,
                    tertiary_colour: e.target.value,
                    accent_colour: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex flex-wrap gap-2 border-t border-[var(--ui-border)] pt-4">
          <Button variant="secondary" onClick={handleResetColours}>
            Reset Colours
          </Button>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </Card>
  )
}
