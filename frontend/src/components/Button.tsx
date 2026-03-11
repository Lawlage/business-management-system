import type { ReactNode } from 'react'
import { Spinner } from './Spinner'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const variantClasses: Record<string, string> = {
  primary: 'app-button',
  secondary:
    'rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] text-[var(--ui-text)] hover:brightness-110',
  danger:
    'rounded-md border border-red-800 bg-red-950/70 text-red-100 hover:bg-red-900/80 font-semibold',
  ghost:
    'rounded-md text-[var(--ui-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-inner-bg)]',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    variantClasses[variant],
    sizeClasses[size],
    'transition inline-flex items-center gap-1.5',
    isLoading || disabled ? 'opacity-60 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button {...rest} className={classes} disabled={isLoading || disabled}>
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
