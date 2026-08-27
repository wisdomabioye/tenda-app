import { useFeePercents } from '@/hooks/usePlatformConfig'
import { HERO_STATS_FALLBACK, FEE_STAT_INDEX, type HeroStat } from './content'

/**
 * The hero stat cells. Exactly ONE of them is live: the fee, read from
 * /v1/platform/config, falling back to the static value while it loads or if
 * the call fails. The rest come from ./content already correct — including the
 * fiat-markets count, which is derived there from the payout registry.
 *
 * Overriding by index rather than rebuilding the array is deliberate: the row
 * previously restated two of the four cells here, and one of those restatements
 * (the markets count) silently shadowed the value in ./content, so the two
 * could disagree with nothing to notice. One cell is special; only that cell is
 * mentioned.
 */
function useHeroStats(): readonly HeroStat[] {
  const { posterFeePct } = useFeePercents()
  if (posterFeePct == null) return HERO_STATS_FALLBACK
  return HERO_STATS_FALLBACK.map((stat, i) =>
    i === FEE_STAT_INDEX ? { ...stat, value: `${posterFeePct}%` } : stat,
  )
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
