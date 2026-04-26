import { CURRENCY_LIST } from '@/data/currencies'
import { Pill } from '@/components/ui/Pill'
import { FEE_COMPARE, SPEED_COMPARE, type PillarAccent } from './content'
import { cn } from '@/lib/cn'

const ACCENT_VAR: Record<PillarAccent, string> = {
  brand:   'var(--brand)',
  service: 'var(--success)',
  errand:  'var(--accent)',
  content: 'var(--content-primary)',
}

/* ============================================================================
 * P1 · SPEED — vertical bar chart
 *
 * Compare-bars use color-mix against --content-primary so they stay visible
 * in both light (dark fill on cream) and dark (light fill on navy) themes.
 * ============================================================================ */
const COMPARE_FILL = 'color-mix(in oklab, var(--content-primary) 28%, transparent)'

export function SpeedBars() {
  return (
    <div className="flex h-32 items-end justify-center gap-3.5">
      {SPEED_COMPARE.map((b) => (
        <div key={b.who} className="flex w-16 flex-col items-stretch gap-1.5">
          <div className="flex h-full items-end">
            <div
              className="w-full rounded-md"
              style={{
                height: `${b.fillPct}%`,
                background: b.highlight ? ACCENT_VAR.brand : COMPARE_FILL,
              }}
            />
          </div>
          <span
            className={cn(
              'caption text-center uppercase tracking-[0.06em]',
              b.highlight ? 'text-[var(--brand)]' : 'text-[var(--content-tertiary)]',
            )}
          >
            {b.who}
          </span>
          <span
            className={cn(
              'mono-sm text-center font-semibold',
              b.highlight ? 'text-[var(--brand)]' : 'text-[var(--content-secondary)]',
            )}
          >
            {b.duration}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ============================================================================
 * P2 · PROOF — receipt-style 3-row card
 * ============================================================================ */
export function ProofReceipt() {
  return (
    <div className="flex h-32 items-center justify-center">
      <div className="w-full max-w-[260px] rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-dashed border-[var(--border-subtle)] pb-2">
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">Event</span>
          <Pill tone="success" size="sm" dot>
            Settled
          </Pill>
        </div>
        <div className="flex items-center justify-between border-b border-dashed border-[var(--border-subtle)] py-2">
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">Payout</span>
          <span className="mono-sm font-semibold text-[var(--success)]">0.4875 SOL</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">Tx</span>
          <span className="mono-sm rounded bg-[var(--surface-inset)] px-2 py-0.5 text-[var(--content-secondary)]">
            5Qf…aL2
          </span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * P3 · COST — horizontal fee bars
 * ============================================================================ */
export function FeeBars() {
  return (
    <div className="flex h-32 flex-col justify-center gap-1.5">
      {FEE_COMPARE.map((row) => (
        <div key={row.who} className="grid grid-cols-[88px_1fr_56px] items-center gap-3">
          <span
            className={cn(
              'mono-sm uppercase tracking-[0.08em]',
              row.highlight ? 'text-[var(--accent)] font-semibold' : 'text-[var(--content-tertiary)]',
            )}
          >
            {row.who}
          </span>
          <span className="relative h-2 rounded-full bg-[var(--border-subtle)]">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${row.fillPct}%`,
                background: row.highlight ? ACCENT_VAR.errand : COMPARE_FILL,
              }}
            />
          </span>
          <span
            className={cn(
              'mono-sm text-right font-semibold',
              row.highlight ? 'text-[var(--accent)]' : 'text-[var(--content-secondary)]',
            )}
          >
            {row.pct}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ============================================================================
 * P4 · BORDERLESS — flag grid
 * ============================================================================ */
export function BorderlessMap() {
  return (
    <div className="flex h-32 items-center justify-center">
      <div className="grid grid-cols-4 gap-2">
        {CURRENCY_LIST.map((c) => (
          <div
            key={c.code}
            className="flex h-12 w-14 flex-col items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] gap-0.5"
            title={c.name}
          >
            <span className="text-base leading-none">{c.flag}</span>
            <span className="mono-sm text-[10px] text-[var(--content-tertiary)]">{c.code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
