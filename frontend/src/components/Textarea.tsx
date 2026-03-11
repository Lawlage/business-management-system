type TextareaProps = {
  label?: string
  error?: string
  hint?: string
  required?: boolean
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({
  label,
  error,
  hint,
  required,
  id,
  className = '',
  ...rest
}: TextareaProps) {
  const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const textareaClasses = [
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
          htmlFor={textareaId}
          className="mb-1 block text-sm font-medium text-[var(--ui-text)]"
        >
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        required={required}
        className={textareaClasses}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-[var(--ui-muted)]">{hint}</p>}
    </div>
  )
}
