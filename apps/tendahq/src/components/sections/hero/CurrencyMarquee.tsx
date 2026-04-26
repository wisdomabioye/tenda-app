import { CURRENCY_LIST, type CurrencyMeta } from '@/data/currencies'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { MarqueeRow } from '@/components/ui/MarqueeRow'

const FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/**
 * Slim currency strip below the hero. Uses the live /v1/platform/exchange-rates
 * payload to render rate per fiat. The rate cell is **always** rendered (with a
 * "—" placeholder when the rate isn't available) so the marquee layout doesn't
 * jump between mobile (often LAN-isolated from the dev API) and desktop.
 *
 * Currencies missing from the upstream feed (e.g. GHS — open issue M83) also
 * use the placeholder.
 */
export function CurrencyMarquee() {
  const { data, loading } = useExchangeRates()
  const rates = data?.rates ?? {}

  const renderItem = (currency: CurrencyMeta) => {
    const rate = rates[currency.code]
    const rateText = rate != null
      ? `${currency.symbol}${FORMATTER.format(rate)} / SOL`
      : loading
        ? '—'
        : `${currency.symbol}— / SOL`

    return (
      <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2">
        <span className="text-base leading-none">{currency.flag}</span>
        <span className="mono-sm font-semibold text-[var(--content-secondary)]">
          {currency.code}
        </span>
        <span className="mono-sm text-[var(--content-tertiary)]">{rateText}</span>
      </div>
    )
  }

  return (
    <div className="border-y border-[var(--border-subtle)] bg-[var(--surface-bg-alt)]">
      <MarqueeRow
        items={CURRENCY_LIST}
        keyOf={(c) => c.code}
        renderItem={renderItem}
        speedSec={42}
        edgeFade
        pauseOnHover
        className="h-14"
      />
    </div>
  )
}
