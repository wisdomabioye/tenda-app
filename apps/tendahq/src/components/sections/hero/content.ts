/**
 * §01 Hero copy. The headline is a brand fixture — do not reword casually.
 * Stat row pulls live values from /v1/platform/config when available;
 * `HERO_STATS_FALLBACK` only renders if the API call fails or is in flight.
 */

import { APP_INFO, FEE_PCT, TRADE_MARKET_COUNT } from '@/content'

export interface HeroStat {
  value: string
  label: string
}

export const HERO_CONTENT = {
  stamps: {
    versionLabel: `${APP_INFO.versionNumber} · ${APP_INFO.chains.stage}`,
    liveLabel: `Live on ${APP_INFO.chains.networksLine}`,
  },
  h1: {
    line1: 'The escrow',
    line2: 'does the',
    line3: 'trusting.',
  },
  ribbon: [
    'The money locks in an on-chain escrow the moment a gig posts or an offer goes live. Nobody holds your funds — not us, not the counterparty, not an exchange.',
    'Proof releases. The contract settles.',
  ] as const,
  cta: {
    primary: 'Download for Android',
  },
  /** Caption under the swipe deck. */
  deckCaption: 'Example gigs · escrow releases on proof',
} as const

/**
 * The one cell HeroStatRow swaps for the live platform fee, matched by label.
 * Declared above the array so the two cannot disagree about the spelling.
 */
const FEE_STAT_LABEL = 'Flat fee'

/**
 * Only the FEE cell is genuinely async — it waits on /v1/platform/config, so
 * it carries a static value for the loading and error paths. Every other cell
 * is either a constant or already known at build time, so they are final here
 * rather than "fallbacks" the row re-derives: the markets count used to be
 * written out as a literal AND overridden in HeroStatRow, which meant the
 * literal was dead and free to drift away from the payout registry unnoticed.
 */
export const HERO_STATS_FALLBACK: readonly HeroStat[] = [
  { value: '< 2s',  label: 'Escrow lock' },
  { value: `${FEE_PCT}%`, label: FEE_STAT_LABEL },
  { value: '100%',  label: 'On-chain' },
  { value: String(TRADE_MARKET_COUNT), label: 'Fiat markets' },
] as const

/**
 * Which cell HeroStatRow replaces with the live platform fee. Derived here,
 * beside the array, so reordering the stats cannot leave the row overwriting
 * the wrong cell — an index written out in the consumer would.
 *
 * A miss yields -1, which no index equals, so the row would quietly keep
 * showing the default fee forever with nothing thrown. That silent mode is
 * what the accompanying test exists to catch.
 */
export const FEE_STAT_INDEX = HERO_STATS_FALLBACK.findIndex(
  (stat) => stat.label === FEE_STAT_LABEL,
)
