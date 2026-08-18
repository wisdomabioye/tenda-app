'use client'

/**
 * The offer page's headline (Tier-3 comp, lines 527-536): what side this is,
 * which escrow, and the rate at the size the reader is actually deciding on.
 *
 * The comp prints the raw escrow id beside the side badge; ours keeps it for
 * the same reason (it is the reference a support conversation needs) but
 * renders it as a `<code>` so it reads as an identifier rather than prose.
 */
import {
  formatRate,
  type ExchangeDetail,
  type SupportedCurrency,
} from '@tenda/shared'
import { ExchangeStatusBadge } from '@/components/escrow/StatusBadge'
import { OFFER_DETAIL_COPY } from './copy'

export function OfferHeadline({ offer }: { offer: ExchangeDetail }) {
  const currency = offer.fiat_currency as SupportedCurrency

  return (
    <header>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border-default bg-surface-inset px-2.5 py-1 font-numeric text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-content-secondary">
          {OFFER_DETAIL_COPY.sideLabel(offer.asset)}
        </span>
        <ExchangeStatusBadge status={offer.status} />
        <code className="font-numeric text-xs leading-4 text-content-tertiary">
          {offer.escrow_id}
        </code>
      </div>

      <h1 className="mt-5 flex flex-wrap items-end gap-3">
        <span className="font-numeric text-[44px] font-bold leading-[48px] tracking-[-1.2px] text-content-primary">
          {formatRate(Number(offer.rate), currency)}
        </span>
        <span className="pb-1.5 font-numeric text-[15px] leading-[22px] text-content-tertiary">
          {OFFER_DETAIL_COPY.rateUnit(offer.fiat_currency, offer.asset)}
        </span>
      </h1>
      <p className="mt-2.5 max-w-[56ch] text-[15px] leading-[22px] text-content-secondary">
        {OFFER_DETAIL_COPY.rateNote}
      </p>
    </header>
  )
}
