/**
 * §05 Live ticker — copy + structure lifted from
 * Tenda V2/landing/sections/05-live-ticker.html.
 *
 * The feed itself is **fully sample data** until M94 lands a public live-feed
 * endpoint. We mark the sample status explicitly in-section so visitors aren't
 * misled by the "STREAMING" pill.
 */

export const TICKER_HEADER = {
  eyebrow: { num: '§ 05', label: 'Live', live: 'Streaming · sample' },
  h2: { lead: 'The receipts', dim: "don't stop." },
  sub: 'Every gig and trade emits one or more on-chain events. The feed below is a sample of the shape — once Tenda is mainnet-live, the actual events tail will stream here.',
  meta: [
    { k: 'Program', v: 'fromAppInfo:programIdShort' },
    { k: 'Network', v: 'fromAppInfo:network · ~400ms blocks' },
  ],
} as const

/** Sample-status banner copy. */
export const TICKER_SAMPLE_NOTICE =
  'This feed is illustrative — every row is hand-picked sample data. The shape is final; live data wires in once the public events tail goes online.'

export const TICKER_TERMINAL = {
  path: 'tenda://',
  pathSuffix: 'events.tail',
  filters: ['All', 'Gigs', 'Exchange', 'Disputes'] as const,
  cols: ['Time', 'Event', 'Context', 'Amount', 'Pair / Fee', 'Region', 'Tx'] as const,
} as const

export const TICKER_FOOT = {
  pillLabel: 'Tailing · last 60s',
  counterLabel: 'Events / min',
  counterValue: '147',
  counterIssue: 'M75',
  link: 'View on Solscan ↗',
} as const

export interface AggCell {
  k: string
  /** Numeric value (without unit). */
  v: string
  /** Suffix unit, e.g. "events", "SOL", "sec", "%". */
  unit?: string
  /** Delta line — `▲/▼ N%`. Tone determines colour. */
  delta: { text: string; tone: 'up' | 'down' | 'neutral' }
  /** Tracking issue id; rendered via Placeholder. */
  issue: string
}

export const AGG_CELLS: readonly AggCell[] = [
  {
    k: 'Settled · 24h',
    v: '8,412',
    unit: 'events',
    delta: { text: '▲ 12.4% vs yesterday', tone: 'up' },
    issue: 'M75',
  },
  {
    k: 'Volume · 24h',
    v: '1,847',
    unit: 'SOL',
    delta: { text: '▲ 8.1% ≈ $336,876', tone: 'up' },
    issue: 'M75',
  },
  {
    k: 'Avg · time-to-release',
    v: '1.7',
    unit: 'sec',
    delta: { text: '▼ 0.1s vs 30d avg', tone: 'neutral' },
    issue: 'M76',
  },
  {
    k: 'Dispute · rate',
    v: '0.31',
    unit: '%',
    delta: { text: '▼ 0.05% vs 30d avg', tone: 'down' },
    issue: 'M76',
  },
]

import type { TickerEvent } from '@/data/mock-feed'

export const EVENT_TONE: Record<TickerEvent, { tone: 'success' | 'brand' | 'warning' | 'danger'; label: string }> = {
  settled:  { tone: 'success', label: 'Settled' },
  locked:   { tone: 'brand',   label: 'Locked' },
  approved: { tone: 'success', label: 'Approved' },
  proof:    { tone: 'warning', label: 'Proof' },
  disputed: { tone: 'danger',  label: 'Disputed' },
}

export const CATEGORY_TONE: Record<string, string> = {
  DEL:   'var(--cat-delivery)',
  PHOTO: 'var(--cat-photo)',
  SVC:   'var(--cat-service)',
  ERR:   'var(--cat-errand)',
  DIG:   'var(--cat-digital)',
  EXCHG: 'var(--accent)',
}
