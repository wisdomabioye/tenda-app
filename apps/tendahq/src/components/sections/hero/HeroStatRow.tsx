import { useFeePercents } from '@/hooks/usePlatformConfig'
import { SUPPORTED_CURRENCIES } from '@/data/currencies'
import { HERO_STATS_FALLBACK, type HeroStat } from './content'
import { cn } from '@/lib/cn'

/**
 * Builds the 4 hero stat cells. The fee value reads live from /v1/platform/config
 * (and gracefully falls back to the static "2.5%" while loading); the fiat-markets
 * count comes from SUPPORTED_CURRENCIES so it stays in sync if a market is added.
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
      value: String(SUPPORTED_CURRENCIES.length),
      label: HERO_STATS_FALLBACK[3].label,
    },
  ]
}

export function HeroStatRow() {
  const stats = useHeroStats()
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-8">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            'flex flex-col gap-1',
            i !== 0 && 'sm:border-l sm:border-[var(--border-subtle)] sm:pl-8',
          )}
        >
          <span className="mono-mid text-[var(--content-primary)]">{s.value}</span>
          <span className="caption uppercase text-[var(--content-tertiary)]">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
