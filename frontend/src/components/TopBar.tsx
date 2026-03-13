import { Link } from 'react-router-dom'
import { LogOut, Menu, Moon, Settings, ShieldAlert, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { roleLabels } from '../types'
import { Button } from './Button'

type TopBarProps = {
  onLogout: () => void
  onStopBreakGlass: () => void
  colorMode: 'light' | 'dark'
  onToggleColorMode: () => void
  onToggleSidebar: () => void
}

export function TopBar({ onLogout, onStopBreakGlass, colorMode, onToggleColorMode, onToggleSidebar }: TopBarProps) {
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
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              onClick={onToggleSidebar}
              className="md:hidden theme-toggle-link rounded-md p-1.5"
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <p className="truncate max-w-[160px] sm:max-w-none font-semibold text-[var(--ui-text)]">{portalTitle}</p>
              {user && (
                <p className="truncate max-w-[160px] sm:max-w-none text-xs text-[var(--ui-muted)]">
                  {user.first_name} {user.last_name}
                  {' · '}
                  {roleLabels[role]}
                </p>
              )}
            </div>
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
                  <ShieldAlert size={14} className="sm:mr-1" />
                  <span className="hidden sm:inline">Tenant Access</span>
                </Button>
              </Link>
            )}

            {inWorkspace && breakGlassToken && (
              <Button variant="danger" size="sm" onClick={onStopBreakGlass}>
                End Break-Glass
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onLogout}>
              <LogOut size={14} className="sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
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
