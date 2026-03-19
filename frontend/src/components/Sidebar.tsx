import { memo } from 'react'
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
  Contact,
  ArrowRightLeft,
  BarChart2,
  ShieldCheck,
  FolderCog,
} from 'lucide-react'
import type { AppRole } from '../types'

type SidebarProps = {
  role: AppRole
  isSuperadminTenantWorkspace: boolean
  isOpen: boolean
  onClose: () => void
}

type NavLink = {
  to: string
  label: string
  icon: React.ReactNode
}

export const Sidebar = memo(function Sidebar({ role, isSuperadminTenantWorkspace, isOpen, onClose }: SidebarProps) {
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
    { to: '/app/clients', label: 'Clients', icon: <Contact size={16} /> },
    { to: '/app/renewable-products', label: 'Renewable Products', icon: <RefreshCw size={16} /> },
    { to: '/app/renewables', label: 'Renewables', icon: <RefreshCw size={16} /> },
    { to: '/app/inventory', label: 'Inventory', icon: <Package size={16} /> },
    ...(role !== 'standard_user'
      ? [{ to: '/app/allocations', label: 'Allocations', icon: <ArrowRightLeft size={16} /> }]
      : []),
    ...(role !== 'standard_user'
      ? [{ to: '/app/reports', label: 'Reports', icon: <BarChart2 size={16} /> }]
      : []),
    { to: '/app/sla-items', label: 'SLA Items', icon: <ShieldCheck size={16} /> },
    { to: '/app/recycle-bin', label: 'Recycle Bin', icon: <Trash2 size={16} /> },
  ]

  const adminLinks: NavLink[] = [
    { to: '/app/admin/users', label: 'User Management', icon: <Users size={16} /> },
    { to: '/app/admin/custom-fields', label: 'Custom Fields', icon: <ClipboardList size={16} /> },
    { to: '/app/admin/departments', label: 'Departments', icon: <FolderCog size={16} /> },
    { to: '/app/admin/tenant-settings', label: 'Tenant Settings', icon: <Settings size={16} /> },
    { to: '/app/admin/audit', label: 'Tenant Audit', icon: <ShieldAlert size={16} /> },
  ]

  const superadminLinks: NavLink[] = [
    { to: '/superadmin', label: 'Tenant Management', icon: <Building2 size={16} /> },
    { to: '/superadmin/audit', label: 'Global Audit', icon: <ShieldAlert size={16} /> },
    { to: '/superadmin/access', label: 'Tenant Access', icon: <Users size={16} /> },
  ]

  return (
    <>
      {/* Mobile backdrop — tapping it closes the drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          // Base: fixed overlay drawer (mobile default)
          'fixed inset-y-0 left-0 z-50 flex h-full w-60 flex-col overflow-y-auto',
          'transform transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: revert to normal flex-flow item
          'md:relative md:translate-x-0 md:flex-shrink-0',
          'app-panel border-r border-[var(--ui-border)]',
        ].join(' ')}
      >
      <div className="px-4 pb-3 pt-5">
        <span className="text-lg font-bold tracking-tight text-[var(--ui-text)]">BMS</span>
      </div>

      <div className="flex-1 p-4">
      {showMainSection && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ui-muted)]">Main</p>
          <nav className="space-y-1">
            {mainLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass(link.to)} onClick={onClose}>
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
              <Link key={link.to} to={link.to} className={linkClass(link.to)} onClick={onClose}>
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
              <Link key={link.to} to={link.to} className={linkClass(link.to)} onClick={onClose}>
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      </div> {/* flex-1 nav area */}
      </aside>
    </>
  )
})
