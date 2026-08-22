const ROWS = 4

export function HomeGigSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading open gigs">
      {Array.from({ length: ROWS }, (_, index) => (
        <div key={index} className="border-b border-border-subtle px-4 py-4 last:border-b-0">
          <div className="h-3 w-20 animate-shimmer rounded bg-surface-inset" />
          <div className="mt-3 h-4 w-3/4 animate-shimmer rounded bg-surface-inset" />
          <div className="mt-2 h-3 w-32 animate-shimmer rounded bg-surface-inset" />
        </div>
      ))}
    </div>
  )
}

