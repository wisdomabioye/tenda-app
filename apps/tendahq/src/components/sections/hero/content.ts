/**
 * Canonical copy from `Tenda V2/landing/sections/01-hero-final.html`.
 * Stat row pulls live values from /v1/platform/config when available;
 * `FALLBACK_STATS` only renders if the API call fails or is in flight.
 */

export interface HeroStat {
  value: string
  label: string
  /** True if the value is hardcoded for now (no live source). */
  placeholder?: { issue: string }
}

export const HERO_CONTENT = {
  stamps: {
    versionLabel: 'v0.2 · DEVNET',
    liveLabel: '247 OFFERS OPEN NOW',
  },
  h1: {
    line1: 'The escrow',
    line2: 'does the',
    line3: 'trusting.',
  },
  ribbon: [
    'SOL locks the moment a gig posts or an offer goes live. Nobody holds your funds — not us, not the counterparty, not an exchange.',
    'Proof releases. The contract settles.',
  ] as const,
  cta: {
    primary: 'Download for Android',
    secondary: 'Read the contract →',
    secondaryHref: 'https://github.com/wisdomabioye/tenda-app',
  },
} as const

export const HERO_STATS_FALLBACK: readonly HeroStat[] = [
  { value: '< 2s',  label: 'Escrow lock' },
  { value: '2.5%',  label: 'Flat fee' },
  { value: '100%',  label: 'On-chain' },
  { value: '8',     label: 'Fiat markets' },
] as const

export const HERO_OPEN_OFFERS_PLACEHOLDER = { value: '247', issue: 'M77' } as const
