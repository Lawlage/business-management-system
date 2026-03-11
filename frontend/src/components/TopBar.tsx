import { Link } from 'react-router-dom'
import { LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'
import { roleLabels } from '../types'
import { Button } from './Button'

type TopBarProps = {
  onLogout: () => void
  onStopBreakGlass: () => void
}

export function TopBar({ onLogout, onStopBreakGlass }: TopBarProps) {
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="font-semibold text-[var(--ui-text)]">{portalTitle}</p>
            {user && (
              <p className="text-xs text-[var(--ui-muted)]">
                {user.email}
                {' · '}
                {roleLabels[role]}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
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
