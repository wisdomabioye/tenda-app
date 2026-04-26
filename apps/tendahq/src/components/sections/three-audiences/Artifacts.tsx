/**
 * Native-product artifact mocks for §08. Each is a small UI surface lifted
 * loosely from the mobile app, sized to fit ~280×180 inside an audience
 * column. Pure visuals — no data wiring, no animation beyond the live dot.
 */

import { Pill } from '@/components/ui/Pill'
import { LiveDot } from '@/components/ui/LiveDot'
import { cn } from '@/lib/cn'

/* ============================================================================
 * C1 · WORKERS — locked job card with checkpoint progress
 * ============================================================================ */
export function WorkerCard() {
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <Pill tone="success" size="sm" dot dotRing>
          Funds locked
        </Pill>
        <span className="mono-sm text-[var(--content-tertiary)]">2m ago</span>
      </div>

      <div>
        <p className="body-sm font-semibold text-[var(--content-primary)]">
          Pick up groceries · Lekki Phase 1
        </p>
        <p className="caption mt-1 uppercase tracking-[0.12em] text-[var(--content-tertiary)]">
          Delivery · 4.2km · today, 6pm
        </p>
      </div>

      <div className="flex items-baseline justify-between rounded-xl bg-[var(--surface-inset)] px-3 py-2.5">
        <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
          Your payout
        </span>
        <span className="mono-mid font-semibold text-[var(--content-primary)]">
          8,500
          <span className="mono-sm ml-1 text-[var(--content-tertiary)]">NGN</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <CheckpointStep state="done" label="Accepted" />
        <CheckpointStep state="active" label="En route" />
        <CheckpointStep state="todo" label="Release" />
      </div>
    </div>
  )
}

function CheckpointStep({ state, label }: { state: 'done' | 'active' | 'todo'; label: string }) {
  const text =
    state === 'done'   ? '✓ ' + label.toUpperCase() :
    state === 'active' ? '→ ' + label.toUpperCase() :
                              label.toUpperCase()
  const tone =
    state === 'done'   ? 'text-[var(--success)]' :
    state === 'active' ? 'text-[var(--accent)]'  :
                         'text-[var(--content-tertiary)]'
  const bar =
    state === 'done'   ? 'bg-[var(--success)]' :
    state === 'active' ? 'bg-[color-mix(in_oklab,var(--accent)_60%,transparent)]' :
                         'bg-[var(--border-subtle)]'
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className={cn('mono-sm text-[10px] font-semibold uppercase tracking-[0.06em]', tone)}>
        {text}
      </span>
      <span className={cn('h-[3px] rounded-full', bar)} />
    </div>
  )
}

/* ============================================================================
 * C2 · POSTERS — mini "My gigs" dashboard
 * ============================================================================ */
export function PosterDashboard() {
  const rows = [
    { title: 'Logo redesign · 3 concepts', meta: 'Digital · 12 applicants',  status: 'Applic.' as const, tone: 'neutral' as const },
    { title: 'Pick up groceries · Lekki',  meta: 'Delivery · in progress',   status: 'Live'    as const, tone: 'brand'   as const },
    { title: 'Event photos · 200 edited',  meta: 'Photo · settled · 2.3s',   status: 'Settled' as const, tone: 'success' as const },
  ] as const

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between">
        <span className="h3 text-[var(--content-primary)]">My gigs</span>
        <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
          3 active
        </span>
      </div>

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {rows.map((row) => (
          <div key={row.title} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="body-sm truncate font-medium text-[var(--content-primary)]">
                {row.title}
              </p>
              <p className="caption uppercase tracking-[0.12em] text-[var(--content-tertiary)]">
                {row.meta}
              </p>
            </div>
            <Pill tone={row.tone} size="sm" dot>
              {row.status}
            </Pill>
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-xl bg-[var(--surface-inset)] p-2">
        <DashboardStat label="Posted" value="14" />
        <DashboardStat label="Escrowed" value="412k" />
        <DashboardStat label="Disputes" value="0" />
      </div>
    </div>
  )
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <span className="caption uppercase tracking-[0.12em] text-[var(--content-tertiary)]">
        {label}
      </span>
      <span className="mono font-semibold text-[var(--content-primary)]">{value}</span>
    </div>
  )
}

/* ============================================================================
 * C3 · TRADERS — orderbook strip (sample data, clearly labelled)
 * ============================================================================ */
export function TraderOrderbook() {
  const bids = [
    { px: '26.412', sz: '12.4k' },
    { px: '26.408', sz: '5.1k'  },
    { px: '26.401', sz: '2.8k'  },
  ]
  const asks = [
    { px: '26.460', sz: '8.2k'  },
    { px: '26.467', sz: '3.6k'  },
    { px: '26.475', sz: '1.9k'  },
  ]

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="mono font-semibold text-[var(--content-primary)]">NGN ↔ PHP</span>
        <Pill tone="accent" size="sm">
          Sample · spread 0.18%
        </Pill>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OrderbookCol side="bid" rows={bids} />
        <OrderbookCol side="ask" rows={asks} />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-inset)] px-3 py-2">
        <span className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
          Last fill
        </span>
        <span className="mono-sm font-semibold text-[var(--content-primary)]">
          26.435{' '}
          <span className="text-[var(--success)]">▲ 0.04%</span>
        </span>
      </div>

      <p className="caption flex items-center gap-1.5 text-[var(--content-tertiary)]">
        <LiveDot size={5} pulseMs={2000} />
        Illustrative — public orderbook arrives with M77.
      </p>
    </div>
  )
}

function OrderbookCol({ side, rows }: { side: 'bid' | 'ask'; rows: readonly { px: string; sz: string }[] }) {
  const tone = side === 'bid' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.px} className="flex items-baseline justify-between">
          <span className={cn('mono-sm font-semibold', tone)}>{r.px}</span>
          <span className="mono-sm text-[var(--content-tertiary)]">{r.sz}</span>
        </div>
      ))}
    </div>
  )
}
