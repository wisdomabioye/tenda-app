'use client'

/**
 * One order-book row — web twin of mobile's ExchangeOfferCard: seller
 * identity + network, the trade (asset → fiat), rate/asset, payment
 * window, optional status badge for My Trades.
 */
import Link from 'next/link'
import { ChevronRight, Clock } from 'lucide-react'
import {
  ASSET_META,
  chainLabel,
  formatAssetAmount,
  formatDurationShort,
  formatFiat,
  formatFullName,
  type ExchangeSummary,
  type SupportedCurrency,
} from '@tenda/shared'
import { Avatar } from '@/components/ui/Avatar'
import { ExchangeStatusBadge } from '@/components/escrow/StatusBadge'

export function ExchangeOfferCard({ offer, showStatus = false }: { offer: ExchangeSummary; showStatus?: boolean }) {
  const fiat = formatFiat(Number(offer.fiat_amount), offer.fiat_currency as SupportedCurrency)
  const rate = formatFiat(Number(offer.rate), offer.fiat_currency as SupportedCurrency)
  const symbol = ASSET_META[offer.asset]?.symbol ?? offer.asset
  const sellerName = formatFullName(offer.creator.first_name, offer.creator.last_name) || 'Seller'
  const score = offer.creator.review_score === null ? null : Number(offer.creator.review_score)

  return (
    <Link
      href={`/exchange/${offer.escrow_id}`}
      className="flex items-start gap-3 border-b border-border-subtle px-1 py-3.5 transition-opacity hover:opacity-80"
    >
      <Avatar src={offer.creator.avatar_url} name={sellerName} size="md" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">{sellerName}</span>
          <span className="shrink-0 rounded-full bg-surface-inset px-2 py-0.5 font-numeric text-[10.5px] text-content-secondary">
            {chainLabel(offer.chain_id)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center gap-1.5 font-numeric text-[15px] font-semibold text-content-primary">
          {formatAssetAmount(offer.amount_raw, offer.asset)}
          <span className="text-content-tertiary">→</span>
          {fiat}
        </span>

        <span className="mt-0.5 block truncate font-numeric text-xs text-content-tertiary">
          {score !== null && <span className="text-accent-primary">★ {score.toFixed(1)} · </span>}
          {rate}/{symbol}
        </span>

        <span className="mt-1 flex items-center gap-1.5 text-xs text-content-tertiary">
          <Clock size={12} /> Pay within {formatDurationShort(offer.payment_window_seconds)}
          {showStatus && (
            <span className="ml-auto">
              <ExchangeStatusBadge status={offer.status} />
            </span>
          )}
        </span>
      </span>

      <ChevronRight size={20} className="mt-3 shrink-0 text-content-tertiary" />
    </Link>
  )
}
