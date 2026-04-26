import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { LiveDot } from '@/components/ui/LiveDot'
import { Placeholder } from '@/components/ui/Placeholder'
import { MOCK_TICKER_ROWS } from '@/data/mock-feed'
import { FeedRow } from './FeedRow'
import { TICKER_FOOT, TICKER_TERMINAL } from './content'
import { cn } from '@/lib/cn'

/**
 * Feed terminal — top bar (terminal-dots + tenda://events.tail + filter chips),
 * column headers (lg+), feed rows, footer (tailing pill + sparkline + counter).
 *
 * Filter chips are wired but functionally cosmetic for the wireframe sample —
 * they don't actually filter MOCK_TICKER_ROWS. Real filtering will arrive with
 * the public live-feed endpoint (M77 / M94).
 */
export function FeedShell() {
  const [activeFilter, setActiveFilter] = useState<string>(TICKER_TERMINAL.filters[0])

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)]">
      <TopBar activeFilter={activeFilter} onFilter={setActiveFilter} />
      <ColumnHeader />
      <div className="flex flex-col">
        {MOCK_TICKER_ROWS.map((row) => (
          <FeedRow key={row.id} row={row} />
        ))}
      </div>
      <FeedFooter />
    </div>
  )
}

function TopBar({ activeFilter, onFilter }: { activeFilter: string; onFilter: (f: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2.5">
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#E7544A]" />
        <span className="h-2 w-2 rounded-full bg-[#E0B33C]" />
        <span className="h-2 w-2 rounded-full bg-[#3ACB8E]" />
      </span>
      <span className="mono-sm shrink-0 text-[var(--content-secondary)]">
        <span className="text-[var(--content-tertiary)]">{TICKER_TERMINAL.path}</span>
        {TICKER_TERMINAL.pathSuffix}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {TICKER_TERMINAL.filters.map((label) => {
          const isActive = label === activeFilter
          return (
            <button
              key={label}
              type="button"
              onClick={() => onFilter(label)}
              className={cn(
                'caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 uppercase tracking-[0.12em] transition-colors',
                isActive
                  ? 'bg-[var(--brand-surface)] text-[var(--brand)]'
                  : 'text-[var(--content-tertiary)] hover:text-[var(--content-secondary)]',
              )}
            >
              {isActive && <LiveDot size={5} pulseMs={1600} />}
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ColumnHeader() {
  return (
    <div className="hidden gap-x-4 border-b border-[var(--border-subtle)] bg-[var(--surface-bg-alt)] px-4 py-2 lg:grid lg:grid-cols-[68px_104px_minmax(0,1.4fr)_92px_minmax(0,1.1fr)_minmax(0,1fr)_88px]">
      {TICKER_TERMINAL.cols.map((col) => (
        <span key={col} className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
          {col}
        </span>
      ))}
    </div>
  )
}

function FeedFooter() {
  const sparkBars = [30, 55, 42, 70, 38, 62, 48, 80, 54, 65, 44, 72, 58, 88, 50, 68, 46, 78, 60, 92]
  return (
    <div className="grid items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-3 lg:grid-cols-[auto_1fr_auto_auto] lg:gap-6">
      <span className="caption inline-flex items-center gap-2 uppercase tracking-[0.16em] text-[var(--success)]">
        <LiveDot size={6} />
        {TICKER_FOOT.pillLabel}
      </span>

      <div className="flex h-8 items-end gap-[3px]" aria-hidden>
        {sparkBars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-sm bg-[color-mix(in_oklab,var(--success)_50%,transparent)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <span className="mono-sm inline-flex items-center gap-2 text-[var(--content-tertiary)]">
        <span className="caption uppercase tracking-[0.16em]">{TICKER_FOOT.counterLabel}</span>
        <Placeholder issue={TICKER_FOOT.counterIssue}>
          <b className="font-bold text-[var(--content-primary)]">{TICKER_FOOT.counterValue}</b>
        </Placeholder>
      </span>

      <a
        href="#"
        className="mono-sm inline-flex items-center gap-1 text-[var(--brand)] hover:underline"
      >
        {TICKER_FOOT.link.replace('↗', '')}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
