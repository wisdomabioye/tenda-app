import { Pill } from '@/components/ui/Pill'
import { CURRENCIES } from '@/data/currencies'
import type { MockOfferCard } from '@/data/mock-feed'
import { cn } from '@/lib/cn'

interface Props {
  offer: MockOfferCard
  className?: string
}

const FIAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const RATE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * Offer summary card used inside the §03 Exchange panel. Matches the wireframe's
 * "SELLING / FOR" labelled trade row, which is wider/denser than the standalone
 * <MockOfferCard>. Section-scoped so the standalone primitive stays focused on
 * the marketplace listing case.
 */
export function OfferSummary({ offer, className }: Props) {
  const meta = CURRENCIES[offer.currency]

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5',
        'shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="success" size="sm" dot>
          Open · Escrow locked
        </Pill>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {offer.paymentMethods.map((m) => (
            <Pill key={m} tone="neutral" size="sm">
              {m}
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Selling</p>
          <p className="mono-large mt-1 text-[var(--content-primary)]">
            {offer.amountSol.toFixed(2)}
          </p>
          <p className="mono-sm text-[var(--content-tertiary)]">SOL · locked</p>
        </div>
        <span aria-hidden className="mono-mid text-[var(--content-tertiary)]">↔</span>
        <div className="text-right">
          <p className="caption uppercase text-[var(--content-tertiary)]">For</p>
          <p className="mono-mid mt-1 text-[var(--content-primary)]">
            {FIAT.format(offer.fiatAmount)}
          </p>
          <p className="mono-sm text-[var(--content-tertiary)]">{offer.currency} · bank</p>
        </div>
      </div>

      <div className="hairline" />

      <div className="flex items-center justify-between">
        <span className="mono-sm text-[var(--content-secondary)]">
          Rate · {meta.symbol}
          {RATE.format(offer.rate)} / SOL
        </span>
        <span className="mono-sm font-semibold text-[var(--success)]">
          ▲ {offer.spreadPct.toFixed(1)}% above market
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-inset)] px-4 py-3">
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Payment window</p>
          <p className="mono mt-1 text-[var(--content-primary)]">30 min</p>
        </div>
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Tenda fee</p>
          <p className="mono mt-1 text-[var(--content-primary)]">0.050 SOL</p>
        </div>
      </div>
    </div>
  )
}
