import { CATEGORIES } from '@/data/categories'
import type { MockGigCard as MockGigCardData } from '@/data/mock-feed'
import { cn } from '@/lib/cn'

interface Props {
  gig: MockGigCardData
  className?: string
}

/**
 * Translates the price-leading gig row from `Tenda V2/home.html` /
 * `03-two-products.html`. Anatomy:
 *   [cat chip]  [title (mono "who" prefix)]   [SOL amt]   [countdown]
 */
export function MockGigCard({ gig, className }: Props) {
  const cat = CATEGORIES[gig.category]
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--r-card)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2.5',
        'shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <span
        className="caption inline-flex items-center justify-center rounded-md px-2 py-1 font-bold uppercase tracking-[0.06em]"
        style={{
          backgroundColor: `var(--cat-${cat.id}-surface)`,
          color: `var(--cat-${cat.id}-text)`,
        }}
      >
        {cat.emoji} {cat.label}
      </span>

      <div className="min-w-0 flex-1">
        <p className="body-sm truncate text-[var(--content-primary)]">
          {gig.title}
        </p>
        <p className="mono-sm truncate text-[var(--content-tertiary)]">
          {gig.poster} · {gig.city}
        </p>
      </div>

      <span className="mono shrink-0 text-[var(--content-primary)]">
        {gig.amountSol.toFixed(2)} SOL
      </span>

      <span className="mono-sm w-[68px] shrink-0 text-right text-[var(--content-tertiary)]">
        {gig.countdown}
      </span>
    </div>
  )
}
