import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { CURRENCIES, type CurrencyCode } from '@/data/currencies'
import { cn } from '@/lib/cn'

type Phase = 'pending' | 'funding' | 'locked'

interface Props {
  amountSol?: number
  currency?: CurrencyCode
  fiatAmount?: number
  rate?: number
  spreadPct?: number
  trader?: string
  rating?: number
  trades?: number
  /** Disable the on-mount transition; render at the locked state directly. */
  staticState?: boolean
  /** Featured (hero / front-of-wall) styling: brand-blue border, no own shadow
   *  (wrapper supplies glow), top hairline accent. */
  featured?: boolean
  className?: string
}

const PHASE_ORDER: Phase[] = ['pending', 'funding', 'locked']

const PHASE_PILL: Record<Phase, { tone: 'neutral' | 'warning' | 'success'; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  funding: { tone: 'warning', label: 'Funding' },
  locked:  { tone: 'success', label: 'Escrow locked' },
}

/**
 * Hero centerpiece. On mount runs once: pending → funding → locked. Reduced-motion
 * users start at locked state. Anatomy mirrors the OfferSummaryCard but inverted
 * — it's the seller's side, post-funding, with the brand promise visible at the top.
 */
export function MockEscrowCard({
  amountSol = 2.0,
  currency = 'NGN',
  fiatAmount = 490_000,
  rate = 245_000,
  spreadPct = 1.2,
  trader = '@chiamaka',
  rating = 4.9,
  trades = 38,
  staticState = false,
  featured = false,
  className,
}: Props) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => (staticState || reduced ? 'locked' : 'pending'))

  useEffect(() => {
    if (staticState || reduced) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      if (i >= PHASE_ORDER.length) {
        window.clearInterval(id)
        return
      }
      setPhase(PHASE_ORDER[i])
    }, 700)
    return () => window.clearInterval(id)
  }, [staticState, reduced])

  const meta = CURRENCIES[currency]
  const pill = PHASE_PILL[phase]
  const fiat = new Intl.NumberFormat('en-US').format(fiatAmount)
  const rateF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rate)

  return (
    <div
      className={cn(
        'relative w-full max-w-[400px] rounded-[28px] border bg-[var(--surface-card)] p-7',
        featured
          ? 'border-[color-mix(in_oklab,var(--success)_36%,transparent)]'
          : 'border-[var(--border-default)] shadow-[var(--shadow-modal)]',
        className,
      )}
      data-phase={phase}
    >
      {featured && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, color-mix(in oklab, var(--success) 70%, transparent), transparent)',
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <Pill tone={pill.tone} size="md" dot dotRing={featured}>
          {pill.label}
        </Pill>
        <span className="mono-sm text-[var(--content-tertiary)]">02:14:48</span>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-2">
        <span className="mono-large text-[var(--content-primary)]">
          {amountSol.toFixed(2)}
          <span className="mono ml-1 text-[var(--content-tertiary)]">SOL</span>
        </span>
        <span className="mono-mid text-[var(--content-tertiary)]">→</span>
        <span className="mono-mid text-[var(--content-primary)]">
          {meta.flag} {fiat}
          <span className="mono-sm ml-1 text-[var(--content-tertiary)]">{currency}</span>
        </span>
      </div>

      <p className="mono-sm mt-2 text-[var(--content-tertiary)]">
        Rate: {meta.symbol}
        {rateF} / SOL
        <span className="ml-2 font-semibold text-[var(--success)]">
          +{spreadPct.toFixed(1)}% above market
        </span>
      </p>

      <div className="hairline my-6" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Payment window</p>
          <p className="mono mt-1 text-[var(--content-primary)]">30 min</p>
        </div>
        <div>
          <p className="caption uppercase text-[var(--content-tertiary)]">Tenda fee</p>
          <p className="mono mt-1 text-[var(--content-primary)]">0.050 SOL</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-surface)] text-xs font-bold text-[var(--brand)]"
          aria-hidden
        >
          {trader.slice(1, 2).toUpperCase()}
        </span>
        <span className="mono-sm text-[var(--content-secondary)]">{trader}</span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="mono-sm flex items-center gap-1 text-[var(--content-secondary)]">
          <Star className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]" />
          {rating.toFixed(1)}
        </span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="mono-sm text-[var(--content-secondary)]">{trades} trades</span>
      </div>
    </div>
  )
}
