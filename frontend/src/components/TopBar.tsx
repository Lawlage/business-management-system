import { Link } from 'react-router-dom'
import { LogOut, Moon, Settings, ShieldAlert, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { roleLabels } from '../types'
import { Button } from './Button'

type TopBarProps = {
  onLogout: () => void
  onStopBreakGlass: () => void
  colorMode: 'light' | 'dark'
  onToggleColorMode: () => void
}

export function TopBar({ onLogout, onStopBreakGlass, colorMode, onToggleColorMode }: TopBarProps) {
  const { user } = useAuth()
  const { role, selectedTenant, isSuperadminTenantWorkspace, breakGlassToken } = useTenant()

  const isSuperadmin = role === 'global_superadmin'
  const inWorkspace = isSuperadmin && isSuperadminTenantWorkspace
  const showBreakGlassBanner = inWorkspace && !!breakGlassToken

  const portalTitle = isSuperadmin && !isSuperadminTenantWorkspace
    ? 'Global Superadmin Portal'
    : selectedTenant
      ? selectedTenant.slug
        ? `${selectedTenant.name} (${selectedTenant.slug})`
        : selectedTenant.name
      : 'Tenant Workspace'

  return (
    <>
      <header className="border-b border-[var(--ui-border)] app-panel">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <p className="font-semibold text-[var(--ui-text)]">{portalTitle}</p>
            {user && (
              <p className="text-xs text-[var(--ui-muted)]">
                {user.first_name} {user.last_name}
                {' · '}
                {roleLabels[role]}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleColorMode}
              className="theme-toggle-link rounded-md p-1.5"
              aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {colorMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <Link to="/app/account">
              <button
                className="theme-toggle-link rounded-md p-1.5"
                aria-label="Account settings"
              >
                <Settings size={16} />
              </button>
            </Link>

            {isSuperadmin && !isSuperadminTenantWorkspace && (
              <Link to="/superadmin/access">
                <Button variant="secondary" size="sm">
                  <ShieldAlert size={14} className="mr-1" />
                  Tenant Access
                </Button>
              </Link>
            )}

            {inWorkspace && breakGlassToken && (
              <Button variant="danger" size="sm" onClick={onStopBreakGlass}>
                End Break-Glass
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onLogout}>
              <LogOut size={14} className="mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {showBreakGlassBanner && (
        <div className="border-b border-red-400 bg-red-700 px-4 py-2 text-sm font-semibold text-white">
          Superadmin break-glass session active for: {selectedTenant?.name ?? 'Unknown Tenant'}
        </div>
      )}
    </>
  )
}
