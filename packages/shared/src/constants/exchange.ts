/** Minimum character count for a dispute reason (enforced on both server and client). */
export const EXCHANGE_DISPUTE_REASON_MIN_LENGTH = 10

/** Maximum character count for a dispute reason (enforced on both server and client). */
export const EXCHANGE_DISPUTE_REASON_MAX_LENGTH = 2000

/** Maximum character count for a dispute-thread message (CO7 mediation). */
export const DISPUTE_MESSAGE_MAX_LENGTH = 2000

/** Payment-window bounds for exchange offers (accept → fiat paid). */
export const EXCHANGE_PAYMENT_WINDOW_MIN_SECONDS = 3_600
export const EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS = 24 * 60 * 60
export const EXCHANGE_PAYMENT_WINDOW_MAX_SECONDS = 7 * 24 * 60 * 60

/**
 * Upper rails for offer terms — far below the numeric(20,4)/numeric(30,10)
 * column limits so absurd input fails validation (400) instead of
 * overflowing in the driver (500).
 */
export const EXCHANGE_MAX_FIAT_AMOUNT = 1_000_000_000_000
export const EXCHANGE_MAX_RATE = 1_000_000_000
