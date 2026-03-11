type SkeletonRowProps = {
  cols?: number
  className?: string
}

const colWidths = ['w-1/4', 'w-1/3', 'w-1/5', 'w-2/5', 'w-1/6', 'w-1/2']

export function SkeletonRow({ cols = 4, className = '' }: SkeletonRowProps) {
  return (
    <div
      className={`animate-pulse rounded-md border border-[var(--ui-border)] p-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-[var(--ui-inner-bg)] ${colWidths[i % colWidths.length]}`}
          />
        ))}
      </div>
    </div>
  )
}
