/**
 * §06 Why Tenda — light interlude after the dark spine. Four equal pillars,
 * each carrying its own proof artifact. Copy lifted from
 * Tenda V2/landing/sections/06-why-tenda.html with two corrections:
 *
 *   1. P2's footer ("Audited · OtterSec · Mar 2025") replaced with the same
 *      honest copy used in §04 — we haven't audited yet.
 *   2. P4's body originally said "Eight fiat corridors, ten supported markets"
 *      — we have 8 currencies; the "ten markets" claim is dropped.
 *
 * Per accent token mapping in index.css.
 */

import { SUPPORTED_CURRENCIES } from '@/data/currencies'

export type PillarAccent = 'brand' | 'service' | 'errand' | 'content'
export type PillarVisualKind = 'speed-bars' | 'proof-receipt' | 'fee-bars' | 'borderless-map'

export interface Pillar {
  num: '01' | '02' | '03' | '04'
  tag: string
  accent: PillarAccent
  visual: PillarVisualKind
  headline: { lead: string; emphasis: string }
  body: string
  foot: { label: string; ref: string; placeholder?: string }
}

export const WHY_HEADER = {
  eyebrow: { num: '§ 06', label: 'Why Tenda' },
  h2: { line1: 'Four reasons it works.', dim: 'All of them measurable.' },
  sub: 'No mission statements. No vague pledges. Each pillar carries its own proof — a stat, a receipt, a comparison — that you can verify on-chain or against the public competition.',
} as const

export const PILLARS: readonly Pillar[] = [
  {
    num: '01',
    tag: 'Speed',
    accent: 'brand',
    visual: 'speed-bars',
    headline: { lead: 'Settlement in', emphasis: 'under two seconds.' },
    body: 'No "pending." No 5-day clearing. Approval and payout happen in the same Solana block — typically faster than your bank\'s app can refresh.',
    foot: { label: 'Avg release', ref: '1.7s · 30d rolling', placeholder: 'M76' },
  },
  {
    num: '02',
    tag: 'Proof',
    accent: 'service',
    visual: 'proof-receipt',
    headline: { lead: 'Every release is', emphasis: 'a receipt you can verify.' },
    body: "Funds aren't moved by a Tenda admin. The on-chain program does it, atomically, on proof. You can look up any settlement on Solscan — no Tenda login required.",
    foot: { label: 'Audit', ref: 'Pre-mainnet · pending' },
  },
  {
    num: '03',
    tag: 'Cost',
    accent: 'errand',
    visual: 'fee-bars',
    headline: { lead: 'A flat', emphasis: '2.5%. Nothing else.' },
    body: 'No subscription tier. No "premium" boost. No spread on the FX rate. The fee is split into the same transaction that pays the worker — visible on every receipt.',
    foot: { label: 'Across', ref: 'all categories · all corridors' },
  },
  {
    num: '04',
    tag: 'Borderless',
    accent: 'content',
    visual: 'borderless-map',
    headline: { lead: 'One wallet works', emphasis: 'everywhere.' },
    body: `${SUPPORTED_CURRENCIES.length} fiat corridors, one balance. A worker in Lagos can earn from a poster in Manila, settle to NGN — and the wallet doesn't blink.`,
    foot: { label: 'Markets', ref: SUPPORTED_CURRENCIES.join(' · ') },
  },
] as const

/** Used by `PillarVisuals.tsx` for the speed-bars chart. */
export const SPEED_COMPARE = [
  { who: 'Tenda',     duration: '< 2s',  fillPct: 14,  highlight: true  },
  { who: 'PayPal',    duration: '3–5d',  fillPct: 50,  highlight: false },
  { who: 'Bank wire', duration: '5–7d',  fillPct: 100, highlight: false },
] as const

/** Used by `PillarVisuals.tsx` for the fee-bars chart. */
export const FEE_COMPARE = [
  { who: 'Tenda',         pct: '2.5%',   fillPct: 12,  highlight: true  },
  { who: 'Fiverr',        pct: '20–25%', fillPct: 100, highlight: false },
  { who: 'Bank wire',     pct: '$25+',   fillPct: 60,  highlight: false },
  { who: 'Western Union', pct: '~7%',    fillPct: 35,  highlight: false },
] as const
