import type { ReactNode } from 'react'

type CardProps = {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevated?: boolean
  className?: string
  children: ReactNode
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ padding = 'md', elevated = false, className = '', children }: CardProps) {
  const classes = [
    'rounded-xl border border-[var(--ui-border)] app-panel',
    paddingMap[padding],
    elevated ? 'shadow-lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={classes}>{children}</div>
}
