type InputProps = {
  label?: string
  error?: string
  hint?: string
  required?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, hint, required, id, className = '', ...rest }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const inputClasses = [
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
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-[var(--ui-text)]"
        >
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      <input id={inputId} required={required} className={inputClasses} {...rest} />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-[var(--ui-muted)]">{hint}</p>}
    </div>
  )
}
