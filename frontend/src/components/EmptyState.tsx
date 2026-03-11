import type { ReactNode } from 'react'

type EmptyStateProps = {
  message: string
  action?: ReactNode
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-[var(--ui-muted)]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
