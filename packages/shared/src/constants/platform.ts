/**
 * Platform-config defaults — the single source for the `platform_config`
 * column defaults AND the server's no-row fallback.
 *
 * These lived in two places before: `.default(...)` in the schema and a
 * hand-written object in `lib/platform.ts`, which could disagree silently on
 * a freshly-seeded database. Declaring them once means a new tunable is one
 * edit, and the fallback can never drift from the column.
 *
 * Values are the operational defaults, not limits: every one is admin-editable
 * at runtime through the singleton row.
 */

export const PLATFORM_CONFIG_DEFAULTS = {
  fee_bps: 250,
  seeker_fee_bps: 100,
  grace_period_seconds: 3_600,
  approval_window_seconds: 172_800,
  default_sponsored_tx_count: 3,
  moderation_rules_version: 1,
  /**
   * Gigs one worker may hold at once. Counts live obligations only — see
   * `features/capacity` for exactly which escrows consume a slot.
   */
  max_pending_gigs: 2,
} as const

/**
 * Upper bound accepted for `max_pending_gigs`, mirrored by a CHECK on the
 * column. Generous on purpose: the cap is a guardrail against over-committing,
 * not a throttle, and operators may want it effectively off while the market
 * is thin.
 */
export const MAX_PENDING_GIGS_CEILING = 100
