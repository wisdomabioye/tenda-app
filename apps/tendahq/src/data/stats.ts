/**
 * Two stat groups:
 *
 *   LIVE_STATS_KEYS — fields derived at runtime from the live API
 *                     (see usePlatformConfig + useExchangeRates). Never hardcode
 *                     these values; consume the hook.
 *
 *   PLACEHOLDER_STATS — wireframe numerics with no public endpoint yet. Each is
 *                        flagged `placeholder: true` so the dev outline + a
 *                        future audit script can find every site that ships
 *                        unverified data. Tracked in open_issues.md M75–M82.
 */

export const LIVE_STATS_KEYS = [
  'posterFeePct',          // from /v1/platform/config — fee_bps / 100
  'workerFeePct',          // from /v1/platform/config — seeker_fee_bps / 100
  'gracePeriodSeconds',    // from /v1/platform/config — used to compute auto-release windows
  'exchangeRates',         // from /v1/platform/exchange-rates — Record<CurrencyCode, number>
] as const

export type LiveStatKey = (typeof LIVE_STATS_KEYS)[number]

interface PlaceholderStat<T = string> {
  value: T
  placeholder: true
  /** Tracking issue in open_issues.md. */
  issue: string
}

const ph = <T,>(value: T, issue: string): PlaceholderStat<T> => ({
  value,
  placeholder: true,
  issue,
})

export const PLACEHOLDER_STATS = {
  /** §02 trust strip + §11 footer status strip. */
  volume24hUsd:        ph('$3.42M', 'M75'),
  volumeDeltaPct:      ph('↑ 11.3%', 'M75'),
  settlements24h:      ph('8,407',   'M75'),

  /** §01 hero eyebrow + trust line · §06 pillar 1 · §10 receipts. */
  weekGigs:            ph('12,847',  'M76'),
  avgSettlementSec:    ph('1.7s',    'M76'),
  disputeRatePct:      ph('0.4%',    'M76'),

  /** §07 coverage map (countries surfaced) — confirm with product. */
  countriesLive:       ph('14',      'M76'),
} as const

export type PlaceholderStatKey = keyof typeof PLACEHOLDER_STATS

export function getPlaceholder(key: PlaceholderStatKey): string {
  return PLACEHOLDER_STATS[key].value
}

/**
 * Hero proof triple — the same three numbers repeat in §01, §02, §06, §10, §11.
 * Designer's note: "If one moves, all move." Pull every site from this list, do
 * not rewrite inline.
 */
export const HERO_PROOF_TRIPLE = [
  PLACEHOLDER_STATS.avgSettlementSec,
  PLACEHOLDER_STATS.volume24hUsd,
  PLACEHOLDER_STATS.disputeRatePct,
] as const
