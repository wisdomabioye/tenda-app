import Link from 'next/link'
import { MapPin } from 'lucide-react'
import {
  formatAssetAmount,
  gigPlaceLabel,
  type GigSummary,
} from '@tenda/shared'
import { CategoryBadge } from '@/components/gig/CategoryBadge'

export function DashboardGigRow({ gig }: { gig: GigSummary }) {
  return (
    <Link
      href={`/gig/${gig.escrow_id}`}
      className="grid min-w-0 gap-3 border-b border-border-subtle px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div>
          <CategoryBadge category={gig.category} />
        </div>
        <h2 className="mt-2 truncate font-display text-[15px] font-semibold text-content-primary">{gig.title}</h2>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-content-tertiary">
          <MapPin size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{gigPlaceLabel(gig)}</span>
        </p>
      </div>
      <span className="font-numeric text-sm font-bold text-utility-money sm:text-right">
        {formatAssetAmount(gig.amount_raw, gig.asset)}
      </span>
    </Link>
  )
}
