import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useMemo, useState } from 'react'

type AppRole = 'standard_user' | 'sub_admin' | 'tenant_admin' | 'global_superadmin'

const roleLabels: Record<AppRole, string> = {
  standard_user: 'Standard User',
  sub_admin: 'Sub Admin',
  tenant_admin: 'Tenant Admin',
  global_superadmin: 'Global Superadmin',
}

function Dashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Most Important Renewals" body="Ordered by urgency with the default 30-day threshold." />
      <Card title="Critical Renewals" body="Renewals expiring in seven days or less are highlighted." />
      <Card title="Low Stock Alerts" body="Inventory below minimum threshold is surfaced for action." />
    </div>
  )
}

function AdminSettings() {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Admin Settings</h2>
      <p className="mt-2 text-sm text-slate-600">Manage users, permissions, custom fields, audit logs, and tenant operations.</p>
    </div>
  )
}

function SuperadminPortal() {
  return (
    <div className="space-y-4">
      <Card title="Tenant Provisioning" body="Create and manage tenant lifecycle with automated database provisioning." />
      <Card title="Break-Glass Access" body="Reason and confirmation are mandatory, and every action is immutably logged." />
    </div>
  )
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  )
}

function App() {
  const [role, setRole] = useState<AppRole>('standard_user')

  const links = useMemo(() => {
    const base = [{ to: '/app', label: 'Dashboard' }]
    if (role === 'tenant_admin') {
      base.push({ to: '/app/admin-settings', label: 'Admin Settings' })
    }
    if (role === 'global_superadmin') {
      base.push({ to: '/superadmin', label: 'Superadmin Portal' })
    }
    return base
  }, [role])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-white text-slate-900">
      <header className="border-b border-amber-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <h1 className="text-xl font-bold tracking-tight">Business Management Platform</h1>
          <select
            aria-label="Role Selector"
            value={role}
            onChange={(event) => setRole(event.target.value as AppRole)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Navigation</p>
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="space-y-4">
          <Routes>
            <Route path="/" element={<Navigate to={role === 'global_superadmin' ? '/superadmin' : '/app'} replace />} />
            <Route path="/app" element={<Dashboard />} />
            <Route
              path="/app/admin-settings"
              element={role === 'tenant_admin' ? <AdminSettings /> : <Navigate to="/app" replace />}
            />
            <Route
              path="/superadmin"
              element={role === 'global_superadmin' ? <SuperadminPortal /> : <Navigate to="/app" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
