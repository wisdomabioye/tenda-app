import { Star } from 'lucide-react'
import { CURRENCIES } from '@/data/currencies'
import type { MockOfferCard as MockOfferCardData } from '@/data/mock-feed'
import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/cn'

interface Props {
  offer: MockOfferCardData
  className?: string
}

/**
 * Translates the OfferSummaryCard from `Tenda V2/exchange-detail.html`. Anatomy:
 *   Top row: status pill + payment-method chips
 *   Rate row: "X.XX SOL → Y CCY" mono
 *   Sub:     rate per SOL · spread badge
 *   Divider
 *   Meta:    Payment window 30m · Tenda fee
 *   Footer:  trader handle · trades · rating
 */
export function MockOfferCard({ offer, className }: Props) {
  const meta = CURRENCIES[offer.currency]
  const fiatFormatted = new Intl.NumberFormat('en-US').format(offer.fiatAmount)
  const rateFormatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(offer.rate)
  // Spread is a money-direction signal, not a state — use --money / --negative.
  const spreadColor =
    offer.spreadPct >= 0 ? 'text-[var(--money)]' : 'text-[var(--warning)]'

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 rounded-[var(--r-card)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5',
        'shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="success" size="sm" dot>
          Open
        </Pill>
        {offer.paymentMethods.map((m) => (
          <Pill key={m} tone="neutral" size="sm">
            {m}
          </Pill>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="mono-mid text-[var(--content-primary)]">
          {offer.amountSol.toFixed(2)}
          <span className="mono-sm ml-1 text-[var(--content-tertiary)]">SOL</span>
        </span>
        <span className="mono text-[var(--content-tertiary)]">→</span>
        <span className="mono-mid text-[var(--content-primary)]">
          {meta.flag} {fiatFormatted}
          <span className="mono-sm ml-1 text-[var(--content-tertiary)]">{offer.currency}</span>
        </span>
      </div>

      <p className="mono-sm text-[var(--content-tertiary)]">
        Rate: {meta.symbol}
        {rateFormatted} / SOL
        <span className={cn('ml-2 font-semibold', spreadColor)}>
          {offer.spreadPct >= 0 ? '+' : ''}
          {offer.spreadPct.toFixed(1)}% {offer.spreadPct >= 0 ? 'above' : 'below'} market
        </span>
      </p>

      <div className="hairline" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Payment window</p>
          <p className="mono mt-1 text-[var(--content-primary)]">30 min</p>
        </div>
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Tenda fee</p>
          <p className="mono mt-1 text-[var(--content-primary)]">~ 0.05 SOL</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[var(--content-secondary)]">
        <span className="mono-sm">{offer.trader}</span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="mono-sm flex items-center gap-1">
          <Star className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]" />
          {offer.rating.toFixed(1)}
        </span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="mono-sm">{offer.trades} trades</span>
      </div>
    </div>
  )
}
