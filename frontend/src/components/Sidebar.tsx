import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  RefreshCw,
  Package,
  Trash2,
  Users,
  Settings,
  ClipboardList,
  ShieldAlert,
  Building2,
} from 'lucide-react'
import type { AppRole } from '../types'

type SidebarProps = {
  role: AppRole
  isSuperadminTenantWorkspace: boolean
}

type NavLink = {
  to: string
  label: string
  icon: React.ReactNode
}

export function Sidebar({ role, isSuperadminTenantWorkspace }: SidebarProps) {
  const location = useLocation()

  const isActive = (to: string) => location.pathname === to

  const linkClass = (to: string) =>
    [
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-[var(--ui-inner-bg)] app-button',
      isActive(to) ? 'font-semibold text-[var(--ui-button-bg)]' : '',
    ]
      .filter(Boolean)
      .join(' ')

  const showMainSection =
    role !== 'global_superadmin' || isSuperadminTenantWorkspace

  const showAdminSection =
    role === 'tenant_admin' || (role === 'global_superadmin' && isSuperadminTenantWorkspace)

  const showSuperadminSection =
    role === 'global_superadmin' && !isSuperadminTenantWorkspace

  const mainLinks: NavLink[] = [
    { to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { to: '/app/renewals', label: 'Renewals', icon: <RefreshCw size={16} /> },
    { to: '/app/inventory', label: 'Inventory', icon: <Package size={16} /> },
    { to: '/app/recycle-bin', label: 'Recycle Bin', icon: <Trash2 size={16} /> },
  ]

  const adminLinks: NavLink[] = [
    { to: '/app/admin/users', label: 'User Management', icon: <Users size={16} /> },
    { to: '/app/admin/custom-fields', label: 'Custom Fields', icon: <ClipboardList size={16} /> },
    { to: '/app/admin/tenant-settings', label: 'Tenant Settings', icon: <Settings size={16} /> },
    { to: '/app/admin/audit', label: 'Tenant Audit', icon: <ShieldAlert size={16} /> },
  ]

  const superadminLinks: NavLink[] = [
    { to: '/superadmin', label: 'Tenant Management', icon: <Building2 size={16} /> },
    { to: '/superadmin/audit', label: 'Global Audit', icon: <ShieldAlert size={16} /> },
    { to: '/superadmin/access', label: 'Tenant Access', icon: <Users size={16} /> },
  ]

  return (
    <aside className="rounded-xl border border-[var(--ui-border)] app-panel p-4">
      {showMainSection && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ui-muted)]">Main</p>
          <nav className="space-y-1">
            {mainLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass(link.to)}>
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {showAdminSection && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ui-muted)]">Admin Settings</p>
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass(link.to)}>
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {showSuperadminSection && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ui-muted)]">Superadmin</p>
          <nav className="space-y-1">
            {superadminLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass(link.to)}>
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </aside>
  )
}
