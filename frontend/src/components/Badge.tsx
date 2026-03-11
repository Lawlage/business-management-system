type BadgeProps = {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  Active: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
  'Expiring Soon': 'bg-amber-900/60 text-amber-300 border border-amber-700/50',
  Expired: 'bg-red-900/60 text-red-300 border border-red-700/50 font-semibold',
  'Action Required': 'bg-red-900/60 text-red-300 border border-red-700/50 font-semibold',
  Suspended: 'bg-slate-800/60 text-slate-400 border border-slate-600/50',
}

export function Badge({ status, className = '' }: BadgeProps) {
  const style =
    statusStyles[status] ??
    'bg-[var(--ui-inner-bg)] text-[var(--ui-muted)] border border-[var(--ui-border)]'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}>
      {status}
    </span>
  )
}
