/** Minimum character count for a dispute reason (enforced on both server and client). */
export const EXCHANGE_DISPUTE_REASON_MIN_LENGTH = 10

/** Maximum character count for a dispute reason (enforced on both server and client). */
export const EXCHANGE_DISPUTE_REASON_MAX_LENGTH = 2000

/** Maximum character count for a dispute-thread message (CO7 mediation). */
export const DISPUTE_MESSAGE_MAX_LENGTH = 2000

/**
 * Fiat-rails provider id for the always-available in-house P2P exchange
 * (decision #14). Shared so the client can recognise a P2P-routed quote —
 * where the escrow platform fee applies — without hardcoding the string.
 */
export const P2P_PROVIDER_ID = 'p2p_internal'

/**
 * Payment-window bounds for exchange offers (accept → fiat paid). Capped at
 * 12h: a P2P fiat transfer is a same-session action, and a long window just
 * lets a buyer sit on locked crypto. Urgency is the product here — the mobile
 * detail screen renders this window as a live H:MM:SS countdown.
 */
export const EXCHANGE_PAYMENT_WINDOW_MIN_SECONDS = 3_600
export const EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS = 12 * 60 * 60
export const EXCHANGE_PAYMENT_WINDOW_MAX_SECONDS = 12 * 60 * 60

/**
 * Upper rails for offer terms — far below the numeric(20,4)/numeric(30,10)
 * column limits so absurd input fails validation (400) instead of
 * overflowing in the driver (500).
 */
export const EXCHANGE_MAX_FIAT_AMOUNT = 1_000_000_000_000
export const EXCHANGE_MAX_RATE = 1_000_000_000
