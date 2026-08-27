import { CURRENCY_LIST, type CurrencyMeta } from '@/content'
import { RATES_CAPTION } from './content'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { MarqueeRow } from '@/components/ui/MarqueeRow'

const FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * Two contrasting tempos — top row scrolls left at 32s with the live rate,
 * bottom row scrolls right at 60s with the currency name. Asymmetric speed +
 * direction = pulse without any extra DOM noise. Layout is identical regardless
 * of whether the API returned rates (placeholder fallback handles both
 * loading + LAN-isolated dev clients; M83-flagged GHS also uses the
 * placeholder when the upstream feed omits it).
 *
 * THE CAPTION IS LOAD-BEARING, and it must describe THIS data. The rows show
 * the SOL price in each currency (the endpoint is `getAssetRates('solana')`),
 * and the currencies are the ones a balance can be DISPLAYED in — not markets
 * you can trade into. Both halves matter: the strip sits immediately below an
 * exchange panel advertising the tradable markets, so unlabelled flags read as
 * markets; and a caption that calls a SOL ticker "your balance" is wrong about
 * its own contents. Do not shorten it to save vertical space.
 *
 * The counts are deliberately absent from this comment. It used to say "eight"
 * three times and "three tradable markets" once; display currencies are now
 * nine and payout markets six, so every one of those had gone stale while
 * sitting above code that derives both.
 */
export function CurrencyMarquee() {
  const { data, loading } = useExchangeRates()
  const rates = data?.rates ?? {}

  const renderRateItem = (currency: CurrencyMeta) => {
    const rate = rates[currency.code]
    const rateText = rate != null
      ? `${currency.symbol}${FORMATTER.format(rate)} / SOL`
      : loading
        ? '—'
        : `${currency.symbol}— / SOL`

    return (
      <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2">
        <span className="text-base leading-none">{currency.flag}</span>
        <span className="mono-sm font-semibold text-[var(--content-primary)]">
          {currency.code}
        </span>
        <span className="mono-sm text-[var(--content-tertiary)]">{rateText}</span>
      </div>
    )
  }

  const renderNameItem = (currency: CurrencyMeta) => (
    <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2">
      <span className="text-sm leading-none opacity-70">{currency.flag}</span>
      <span className="mono-sm uppercase tracking-[0.16em] text-[var(--content-secondary)]">
        {currency.name}
      </span>
      <span className="mono-sm text-[var(--content-tertiary)]">·</span>
      <span className="mono-sm text-[var(--content-tertiary)]">{currency.code}</span>
    </div>
  )

  return (
    <div className="flex flex-col border-y border-[var(--border-subtle)] bg-[var(--surface-bg-alt)] divide-y divide-[var(--border-subtle)]">
      <p className="caption px-4 py-2 text-center uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
        {RATES_CAPTION}
      </p>
      <MarqueeRow
        items={CURRENCY_LIST}
        keyOf={(c) => `r-${c.code}`}
        renderItem={renderRateItem}
        speedSec={32}
        direction="left"
        edgeFade
        pauseOnHover
        className="h-12"
      />
      <MarqueeRow
        items={CURRENCY_LIST}
        keyOf={(c) => `n-${c.code}`}
        renderItem={renderNameItem}
        speedSec={60}
        direction="right"
        edgeFade
        pauseOnHover
        className="h-10 opacity-80"
      />
    </div>
  )
}
