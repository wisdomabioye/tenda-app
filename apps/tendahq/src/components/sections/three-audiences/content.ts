/**
 * §08 Three audiences — copy + structure based on
 * Tenda V2/landing/sections/08-three-audiences.html, with honesty corrections
 * for KPIs that aren't true pre-launch:
 *
 *   1. C1 Workers' "Platform cut 0%" replaced — workers pay 1% per
 *      /v1/platform/config (`seeker_fee_bps: 100`). KPI now reads live.
 *   2. C1 "Avg payout 1.7s" + C2 "Dispute rate 0.4%" flagged via Placeholder
 *      issue M76 (public stats endpoint not yet built).
 *   3. C3 Traders' artifact (orderbook) is illustrative — clearly labelled
 *      "sample" until the public order-flow endpoint exists.
 */

export type AudienceAccent = 'success' | 'brand' | 'accent'
export type AudienceArtifact = 'worker-card' | 'poster-dashboard' | 'trader-orderbook'

export interface AudienceKpi {
  label: string
  /**
   * Literal display value OR a sentinel resolved at render-time:
   *   `'fromLive:posterFeePct'` → `useFeePercents().posterFeePct`
   *   `'fromLive:seekerFeePct'` → `useFeePercents().seekerFeePct` (Solana Mobile discount)
   * Section §08 ships **zero placeholders** — every KPI is either a Solana
   * fact, an escrow guarantee, or a live API value.
   */
  value: string
}

export interface Audience {
  num: '01' | '02' | '03'
  tag: string                        // 'WORKERS' | 'POSTERS' | 'TRADERS'
  tabSuffix: string                  // 'earn' | 'hire' | 'swap'
  accent: AudienceAccent
  artifact: AudienceArtifact
  eyebrow: string                    // 'If you do the work'
  headline: { lead: string; emphasis: string }
  body: string
  kpis: readonly AudienceKpi[]
  /**
   * Optional small inline callout below the KPIs. Used to surface the Solana
   * Mobile (Seeker) device discount on the Posters column. `value` accepts
   * the same `'fromLive:*'` sentinels as KPIs.
   */
  callout?: { prefix: string; value: string; suffix?: string }
  cta: { label: string; href: string }
}

export const AUDIENCES_HEADER = {
  eyebrow: { num: '§ 08', label: "Who it's for" },
  h2: { line1: 'Three sides.', dim: 'One contract.' },
  sub: 'A worker who wants paid the moment the job is done. A poster who wants the work delivered without arguing about it. A trader who wants the spread between them. Tenda gives all three the same guarantee — programmable escrow on Solana.',
} as const

export const AUDIENCES: readonly Audience[] = [
  {
    num: '01',
    tag: 'Workers',
    tabSuffix: 'earn',
    accent: 'success',
    artifact: 'worker-card',
    eyebrow: 'If you do the work',
    headline: { lead: 'Get paid', emphasis: 'the second proof clears.' },
    body: 'Pick up a job, complete it, submit proof. Funds are already locked — they release to your wallet automatically the moment the poster (or the timer) approves. No invoicing. No waiting. No "the payment didn\'t go through."',
    kpis: [
      // Workers (gigs) and buyers (exchange) pay zero today — only the
      // poster / seller pays. "100%" payout is the honest, strong framing.
      { label: 'Settlement',   value: 'Solana · ~400ms' },
      { label: 'Worker keeps', value: '100%' },
    ],
    cta: { label: 'Browse open jobs', href: '/#download' },
  },
  {
    num: '02',
    tag: 'Posters',
    tabSuffix: 'hire',
    accent: 'brand',
    artifact: 'poster-dashboard',
    eyebrow: 'If you need the work done',
    headline: { lead: 'Lock the budget.', emphasis: 'Get the work.' },
    body: "Post a gig, fund the escrow, pick the worker. Your money is held by the contract — not by Tenda, not by the worker. It releases on proof, or returns to you if the job doesn't ship. The worst case is a refund.",
    kpis: [
      // Fee story lives in §06 P3 where it has the comparison-bar context.
      // Here we surface the value-prop a poster cares about most: control.
      { label: 'Refund if unshipped', value: '100%' },
      { label: 'Custody',             value: 'Self-custodial' },
    ],
    callout: { prefix: 'On a Solana Mobile (Seeker) device?', value: 'fromLive:seekerFeePct', suffix: 'platform fee.' },
    cta: { label: 'Post your first gig', href: '/#download' },
  },
  {
    num: '03',
    tag: 'Traders',
    tabSuffix: 'swap',
    accent: 'accent',
    artifact: 'trader-orderbook',
    eyebrow: 'If you move money between currencies',
    headline: { lead: 'Make the spread.', emphasis: 'Bank-clean settlement.' },
    body: "Tenda's worker payouts create real, recurring fiat demand across our supported corridors. Quote a rate, fill an order, settle on-chain. Every fill is a receipt — KYC and bank rails are yours, but the trade itself is atomic.",
    kpis: [
      { label: 'Settlement', value: 'Atomic on-chain' },
      { label: 'KYC',        value: 'Self-managed' },
    ],
    cta: { label: 'Open the exchange', href: '/#download' },
  },
] as const
