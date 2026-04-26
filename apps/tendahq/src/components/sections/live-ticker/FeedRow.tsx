import { ExternalLink } from 'lucide-react'
import { CURRENCIES } from '@/data/currencies'
import type { TickerRow } from '@/data/mock-feed'
import { Pill } from '@/components/ui/Pill'
import { CATEGORY_TONE, EVENT_TONE } from './content'
import { cn } from '@/lib/cn'

interface Props {
  row: TickerRow
}

const FIAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Single row in the ticker feed. On `lg+` renders as a 7-column grid matching
 * the explorer columns. On smaller screens collapses to a denser 2-row layout
 * (top: time + event + amount; bottom: context + region + tx).
 */
export function FeedRow({ row }: Props) {
  const eventMeta = EVENT_TONE[row.event]
  const catColor = CATEGORY_TONE[row.category] ?? 'var(--content-tertiary)'

  return (
    <div
      className={cn(
        'group relative grid gap-x-4 gap-y-1.5 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0',
        // Mobile / md: stacked compact
        'grid-cols-[auto_auto_1fr_auto] items-baseline',
        // Desktop columns: time · event · context · amount · pair · region · tx
        'lg:grid-cols-[68px_104px_minmax(0,1.4fr)_92px_minmax(0,1.1fr)_minmax(0,1fr)_88px] lg:items-center lg:py-3.5',
        row.fresh &&
          'bg-[color-mix(in_oklab,var(--success)_6%,transparent)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--success)]',
      )}
    >
      <span className="mono-sm whitespace-nowrap text-[var(--content-tertiary)]">
        {row.fresh ? <span className="text-[var(--success)]">▸ {row.timestamp}</span> : row.timestamp}
      </span>

      <Pill tone={eventMeta.tone} size="sm" dot>
        {eventMeta.label}
      </Pill>

      <span className="col-span-3 flex min-w-0 items-baseline gap-2 lg:col-span-1">
        <span
          className="caption shrink-0 rounded px-1.5 py-0.5 font-bold uppercase tracking-[0.06em]"
          style={{ background: `color-mix(in oklab, ${catColor} 14%, transparent)`, color: catColor }}
        >
          {row.category}
        </span>
        <span className="body-sm min-w-0 truncate text-[var(--content-secondary)]">
          {row.context}
        </span>
      </span>

      <span className="mono justify-self-end whitespace-nowrap text-[var(--content-primary)]">
        {row.amountSol.toFixed(row.amountSol >= 1 ? 3 : 2)} SOL
      </span>

      <span className="mono-sm hidden min-w-0 truncate text-[var(--content-tertiary)] lg:inline">
        {row.fiat ? (
          <>
            SOL <span className="text-[var(--content-tertiary)]">↔</span>{' '}
            <span className="text-[var(--content-primary)]">
              {CURRENCIES[row.fiat.currency].symbol}
              {FIAT.format(row.fiat.amount)}
            </span>
          </>
        ) : row.pairExtra ? (
          <>
            <span className="text-[var(--content-tertiary)]">{row.pairExtra.label}</span>{' '}
            <span className="text-[var(--content-secondary)]">{row.pairExtra.value}</span>
          </>
        ) : null}
      </span>

      <span className="mono-sm hidden min-w-0 items-center gap-1.5 truncate text-[var(--content-tertiary)] lg:flex">
        <span>{row.region.flag}</span>
        <span className="text-[var(--content-secondary)]">{row.region.city}</span>
        {row.region.corridor && <span>· {row.region.corridor}</span>}
      </span>

      <span className="mono-sm col-span-4 hidden whitespace-nowrap text-[var(--content-tertiary)] lg:col-span-1 lg:inline-flex lg:items-center lg:gap-1 lg:justify-self-end">
        {row.txShort}
        <ExternalLink className="h-3 w-3" />
      </span>
    </div>
  )
}
