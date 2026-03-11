import { Button } from './Button'

type LoadMoreButtonProps = {
  hasMore: boolean
  isLoading?: boolean
  onLoadMore: () => void
}

export function LoadMoreButton({ hasMore, isLoading = false, onLoadMore }: LoadMoreButtonProps) {
  if (!hasMore) {
    return (
      <p className="pt-3 text-center text-xs text-[var(--ui-muted)]">All records loaded</p>
    )
  }

  return (
    <div className="flex justify-center pt-3">
      <Button variant="secondary" size="sm" isLoading={isLoading} onClick={onLoadMore}>
        Load More
      </Button>
    </div>
  )
}
