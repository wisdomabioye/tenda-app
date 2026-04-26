import { Clock } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import type { MockGigCard } from '@/data/mock-feed'
import { cn } from '@/lib/cn'

interface Props {
  gig: MockGigCard
  className?: string
}

/**
 * Dense single-line gig row used inside the §03 Gigs panel preview. Differs
 * from the standalone <MockGigCard> on purpose — that one is the marketplace
 * card with title + poster on two lines; this one collapses to a single line
 * to fit the panel-preview density.
 */
export function GigListRow({ gig, className }: Props) {
  const cat = CATEGORIES[gig.category]
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2.5',
        className,
      )}
    >
      <span
        className="caption inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold uppercase tracking-[0.06em]"
        style={{
          backgroundColor: `var(--cat-${cat.id}-surface)`,
          color: `var(--cat-${cat.id}-text)`,
        }}
      >
        {cat.emoji} {cat.label}
      </span>

      <p className="body-sm min-w-0 flex-1 truncate text-[var(--content-primary)]">
        {gig.title}
        <span className="ml-1.5 mono-sm text-[var(--content-tertiary)]">· {gig.poster}</span>
      </p>

      <span className="mono shrink-0 text-[var(--content-primary)]">
        {gig.amountSol.toFixed(2)} SOL
      </span>

      <span className="mono-sm inline-flex w-[70px] shrink-0 items-center justify-end gap-1 text-[var(--content-tertiary)]">
        <Clock className="h-3 w-3" />
        {gig.countdown}
      </span>
    </div>
  )
}
