import Link from 'next/link'
import { chainLabel, formatAssetAmount, formatRelativeShort, type GigSummary } from '@tenda/shared'
import { CategoryBadge } from './CategoryBadge'
import { GigCreatorLine } from './GigCreatorLine'

/**
 * Feed card, listing fields only. `requires_approval` decides whether the
 * action reads Apply or Accept — visible while browsing on purpose (shared
 * GigSummary doc: anything else is a bait-and-switch).
 */
export function GigCard({ gig }: { gig: GigSummary }) {
  return (
    <article className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card transition-shadow hover:shadow-elevated">
      <Link href={`/gig/${gig.escrow_id}`} className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-content-primary">{gig.title}</h2>
          <span className="font-numeric whitespace-nowrap text-lg font-semibold text-utility-money">
            {formatAssetAmount(gig.amount_raw, gig.asset)}
          </span>
        </div>

        {gig.description !== null && gig.description !== '' && (
          <p className="line-clamp-2 text-sm text-content-secondary">{gig.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-content-tertiary">
          <CategoryBadge category={gig.category} />
          <span>{gig.remote ? 'Remote' : gig.city ?? gig.country ?? 'Anywhere'}</span>
          <span aria-hidden>·</span>
          <span>{chainLabel(gig.chain_id)}</span>
          {gig.created_at !== null && (
            <>
              <span aria-hidden>·</span>
              <span>{formatRelativeShort(gig.created_at)}</span>
            </>
          )}
          <span className="ml-auto rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold text-content-secondary">
            {gig.requires_approval ? 'Apply' : 'Accept'}
          </span>
        </div>

        <GigCreatorLine creator={gig.creator} />
      </Link>
    </article>
  )
}
