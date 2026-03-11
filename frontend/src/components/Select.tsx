import type { ReactNode } from 'react'

type SelectProps = {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
} & React.SelectHTMLAttributes<HTMLSelectElement>

export function Select({
  label,
  error,
  hint,
  required,
  id,
  children,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const selectClasses = [
    'w-full rounded-md border px-3 py-2 text-sm app-panel focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60',
    error ? 'border-red-500' : 'border-[var(--ui-border)]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-sm font-medium text-[var(--ui-text)]"
        >
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      <select id={selectId} required={required} className={selectClasses} {...rest}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-[var(--ui-muted)]">{hint}</p>}
    </div>
  )
}
