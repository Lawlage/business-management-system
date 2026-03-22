import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--ui-muted)' }}>{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
