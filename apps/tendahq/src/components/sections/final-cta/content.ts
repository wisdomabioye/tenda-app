/**
 * §10 Final CTA — copy + structure based on
 * Tenda V2/landing/sections/10-final-cta.html, with two pre-launch corrections:
 *
 *   1. Google Play + App Store buttons render disabled with "Coming soon" —
 *      neither listing exists yet. Only the APK link is live.
 *   2. The QR caption used to read `tenda.so/get` (invalid). Updated to
 *      `tendahq.com/get` — but the route is **not yet implemented**, so the
 *      QR + caption ship as a "preview" with a clear pending label.
 *
 *   3. Receipts strip dropped the wireframe's fictional `1.7s · 1.5% · 0.4%`
 *      triple. Replaced with three pre-launch facts only.
 */

import { APP_INFO } from '@/content'
import { LANDING_CHAINS } from '@/content/chains'
import { FEE_PCT, SEEKER_FEE_PCT } from '@/content/fees'
import { PLATFORM_CONFIG_DEFAULTS } from '@tenda/shared/constants/platform'

export const FINAL_CTA_HEADER = {
  eyebrow: { num: '§ 10', label: 'Ship it' },
  h2: { line1: 'Stop waiting.', accent: 'Start earning.', dim: 'Or hiring. Or trading.' },
  sub: [
    "The contract is live. The wallet's in your pocket.",
    "Whatever side you're on — workers, posters, traders — the next gig is one tap away.",
  ] as const,
} as const

export const DOWNLOAD_BUTTONS = {
  primary: {
    label: 'Download APK',
    sub: `Android · ${APP_INFO.version}`,
    href: APP_INFO.apkUrl,
  },
  stores: [
    { name: 'Google Play', top: 'Get it on',          available: false },
    { name: 'App Store',   top: 'Download on the',    available: false },
  ] as const,
} as const

export const QR_FALLBACK = {
  title: 'Or scan with your phone',
  body: 'Routes to your device store ·',
  /**
   * Final destination once `tendahq.com/get` is implemented. **Not live yet.**
   * The QR pattern below is decorative — pointing it at this URL today would
   * resolve to nothing.
   */
  destination: 'tendahq.com/get',
  pendingLabel: 'preview · launching soon',
} as const

export interface Receipt {
  k: string
  /** Main display value (mono). */
  v: string
  /** Optional unit suffix in muted tone. */
  unit?: string
  /** Subline caption. */
  b: string
}

export const RECEIPTS: readonly Receipt[] = [
  {
    k: 'Chains',
    // Derived, never a hand-typed count: this said '3' beside a networksLine
    // that already listed four — the exact drift the derived subline exists
    // to prevent.
    v: String(LANDING_CHAINS.length),
    unit: ' live',
    b: `${APP_INFO.chains.networksLine} · more coming`,
  },
  {
    k: 'Worker keeps',
    // 100 − fee, in exact bps math off the same platform-config default
    // FEE_PCT displays. 'No platform cut on payouts' was simply false — the
    // fee is real, on-chain, and proudly flat; understating it is the one
    // thing a receipts strip must never do.
    v: String((10_000 - PLATFORM_CONFIG_DEFAULTS.fee_bps) / 100),
    unit: '%',
    b: `One flat ${FEE_PCT}% fee · ${SEEKER_FEE_PCT}% for Seeker owners`,
  },
  {
    k: 'Custody',
    v: 'Yours',
    b: 'Contract-only escrow · no admin override',
  },
]
