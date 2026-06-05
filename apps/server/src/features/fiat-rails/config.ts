/**
 * Fiat-rails tunables (stage-8-fiat-rails.md). Provider API credentials
 * live in server env (config.ts) — the fiat_providers.config jsonb only
 * carries non-secret routing hints.
 */

/** Quote validity window — expired quotes are never honored (§ Risks). */
export const QUOTE_TTL_MS = 10 * 60_000

/**
 * Reconciliation: open intents older than this get a provider.status()
 * poll on each job tick (§ Reconciliation).
 */
export const RECONCILE_MIN_AGE_MS = 5 * 60_000

/** Provider shows no record after this long → mark intent failed. */
export const RECONCILE_GIVE_UP_MS = 24 * 60 * 60_000

/** Batch bound per job tick — keeps the tick O(small) under backlog. */
export const RECONCILE_BATCH_LIMIT = 100

/** p2p_internal spread over the platform mid-rate (bps). */
export const P2P_INTERNAL_SPREAD_BPS = 100

/** The always-available fallback provider id (§ Provider routing). */
export const P2P_INTERNAL_ID = 'p2p_internal'

/**
 * Quote-routing fallback when the user has no stored country — Nigeria is
 * the launch market (stage-8 § Scope).
 */
export const DEFAULT_FIAT_COUNTRY = 'NG'

/**
 * Payment window stamped on p2p_internal exchange escrows (how long the
 * counterparty has to pay fiat after accepting). Mirrors the legacy
 * exchange default.
 */
export const P2P_INTERNAL_PAYMENT_WINDOW_SECONDS = 24 * 60 * 60
