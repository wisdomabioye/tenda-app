import { CURRENCY_LIST, type CurrencyMeta } from '@/data/currencies'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { MarqueeRow } from '@/components/ui/MarqueeRow'

/**
 * Slim currency strip below the hero. Uses the live /v1/platform/exchange-rates
 * payload to render rate per fiat. If a rate is missing (e.g. GHS — issue M83)
 * the cell falls back to flag + code only, never throws.
 */
export function CurrencyMarquee() {
  const { data } = useExchangeRates()
  const rates = data?.rates ?? {}

  const renderItem = (currency: CurrencyMeta) => {
    const rate = rates[currency.code]
    return (
      <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2">
        <span className="text-base">{currency.flag}</span>
        <span className="mono-sm text-[var(--content-secondary)]">{currency.code}</span>
        {rate != null && (
          <span className="mono-sm text-[var(--content-tertiary)]">
            {currency.symbol}
            {Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rate)} / SOL
          </span>
        )}
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
