import type { ProofFeedRow } from '@/data/mock-feed'
import { cn } from '@/lib/cn'

interface Props {
  row: ProofFeedRow
  /** Mobile-friendly: drop the truncated signature column to fit narrow widths. */
  compact?: boolean
  className?: string
}

const VERB_COLOR: Record<ProofFeedRow['verb'], string> = {
  released: 'text-[var(--success)]',
  locked:   'text-[var(--brand)]',
  disputed: 'text-[var(--warning)]',
}

const VERB_LABEL: Record<ProofFeedRow['verb'], string> = {
  released: 'Released',
  locked:   'Locked',
  disputed: 'Disputed',
}

/**
 * Single row in the trust-strip settlement marquee.
 * Anatomy: [verb chip] · [amount] · [who] · [signature] · [time-ago]
 */
export function ProofRow({ row, compact = false, className }: Props) {
  return (
    <span
      className={cn(
        'mono inline-flex min-w-0 max-w-full items-center gap-2.5 whitespace-nowrap text-[13px] text-[var(--content-secondary)]',
        className,
      )}
    >
      <span className={cn('caption shrink-0 uppercase font-semibold tracking-[0.06em]', VERB_COLOR[row.verb])}>
        {VERB_LABEL[row.verb]}
      </span>
      <span className="shrink-0 font-semibold text-[var(--content-primary)]">
        {row.amountSol.toFixed(3)} SOL
      </span>
      <span className="min-w-0 truncate text-[var(--content-secondary)]">{row.who}</span>
      {!compact && (
        <span className="shrink-0 text-[var(--content-tertiary)] text-[11px]">{row.sig}</span>
      )}
      <span className="shrink-0 text-[var(--content-tertiary)] text-[11px]">{row.ago}</span>
    </span>
  )
}
