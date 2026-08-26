import { useFeePercents } from '@/hooks/usePlatformConfig'
import { TRADE_MARKET_COUNT } from '@/content'
import { HERO_STATS_FALLBACK, type HeroStat } from './content'

/**
 * Builds the 4 hero stat cells. The fee value reads live from /v1/platform/config
 * (and gracefully falls back to the static "2.5%" while loading); the fiat-markets
 * count comes from the payout registry — the currencies an offer can actually be
 * denominated in — NOT from SUPPORTED_CURRENCIES, which is the longer list of
 * currencies a balance can merely be DISPLAYED in. This cell used to show that
 * longer number under a "Fiat markets" label.
 */
function useHeroStats(): readonly HeroStat[] {
  const { posterFeePct } = useFeePercents()
  return [
    HERO_STATS_FALLBACK[0],
    {
      value: posterFeePct != null ? `${posterFeePct}%` : HERO_STATS_FALLBACK[1].value,
      label: HERO_STATS_FALLBACK[1].label,
    },
    HERO_STATS_FALLBACK[2],
    {
      value: String(TRADE_MARKET_COUNT),
      label: HERO_STATS_FALLBACK[3].label,
    },
  ]
}

export function HeroStatRow() {
  const stats = useHeroStats()
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-x-8">
      {stats.map((s, i) => (
        <div key={s.label} className="relative flex flex-col gap-1">
          {i !== 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-[-1rem] top-1/2 hidden h-4 -translate-y-1/2 sm:block"
              style={{
                width: 1,
                background:
                  'linear-gradient(180deg, transparent, color-mix(in oklab, var(--brand) 50%, transparent), transparent)',
              }}
            />
          )}
          <span className="mono-mid text-[var(--content-primary)]">{s.value}</span>
          <span className="caption uppercase text-[var(--content-tertiary)]">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
