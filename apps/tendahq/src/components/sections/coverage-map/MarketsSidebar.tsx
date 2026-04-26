/**
 * §07 Coverage — markets sidebar (preserved, currently unmounted).
 *
 * Removed from `<Coverage>` while we're pre-launch — there's no real volume
 * to rank, so a "Top markets · By 30d volume" sidebar would mislead. Kept on
 * disk so it can be remounted in `Coverage.tsx` once the public stats
 * endpoint (issue M75) is live and the data is real.
 *
 * The schema is now status-based (`pilot` / `devnet`) — re-add `volume_usd`
 * or similar fields to `CoverageMarket` and a header/footer copy block when
 * reactivating.
 */

import {
  COVERAGE_MARKETS,
  STATUS_LABEL,
  getCurrencyMeta,
  type CoverageMarket,
  type MarketStatus,
} from './content'
import { cn } from '@/lib/cn'

const STATUS_TONE: Record<MarketStatus, { text: string; dotShadow: string; dotBg: string }> = {
  pilot: {
    text: 'text-[var(--accent)]',
    dotShadow: 'shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_20%,transparent)]',
    dotBg: 'bg-[var(--accent)]',
  },
  devnet: {
    text: 'text-[var(--success)]',
    dotShadow: 'shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_20%,transparent)]',
    dotBg: 'bg-[var(--success)]',
  },
}

const SIDEBAR_COPY = {
  title: 'Markets',
  caption: 'Pre-launch · all 8 supported',
  sub: "Tenda is on Solana devnet today. Every supported corridor is live for testing — public-launch volume metrics will replace this caption once available.",
} as const

export function MarketsSidebar() {
  return (
    <aside className="flex flex-col rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)]">
      <header className="flex flex-col gap-2 border-b border-[var(--border-subtle)] px-5 py-4">
        <p className="flex items-baseline justify-between gap-3">
          <span className="h3 text-[var(--content-primary)]">{SIDEBAR_COPY.title}</span>
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
            {SIDEBAR_COPY.caption}
          </span>
        </p>
        <p className="body-sm text-[var(--content-secondary)]">{SIDEBAR_COPY.sub}</p>
      </header>

      <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {COVERAGE_MARKETS.map((m) => (
          <MarketRow key={m.code} market={m} />
        ))}
      </ul>
    </aside>
  )
}

function MarketRow({ market }: { market: CoverageMarket }) {
  const meta = getCurrencyMeta(market.code)
  const tone = STATUS_TONE[market.status]

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="text-lg leading-none" aria-hidden>
        {meta.flag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mono-sm font-semibold text-[var(--content-primary)]">{market.code}</p>
        <p className="body-sm truncate text-[var(--content-tertiary)]">{market.country}</p>
      </div>
      <span className={cn('mono-sm inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em]', tone.text)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', tone.dotBg, tone.dotShadow)} />
        {STATUS_LABEL[market.status]}
      </span>
    </li>
  )
}
