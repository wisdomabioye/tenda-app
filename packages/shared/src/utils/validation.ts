// Minimum payment: 1,000,000 lamports (0.001 SOL) — mirrors MIN_PAYMENT in smart contract
export const MIN_PAYMENT_LAMPORTS = 1_000_000
// Maximum payment: 10,000 SOL in lamports — practical upper bound
export const MAX_PAYMENT_LAMPORTS = 10_000 * 1_000_000_000

export const MAX_GIG_TITLE_LENGTH       = 200
export const MAX_GIG_DESCRIPTION_LENGTH = 5000
export const MAX_DISPUTE_REASON_LENGTH  = 2000

// Duration bounds
export const MIN_COMPLETION_DURATION_SECONDS = 60 * 60        // 1 hour
export const MAX_COMPLETION_DURATION_SECONDS = 60 * 60 * 24 * 90 // 90 days

export function isValidPaymentLamports(amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= MIN_PAYMENT_LAMPORTS &&
    amount <= MAX_PAYMENT_LAMPORTS
  )
}

export function isValidCompletionDuration(seconds: number): boolean {
  return (
    Number.isInteger(seconds) &&
    seconds >= MIN_COMPLETION_DURATION_SECONDS &&
    seconds <= MAX_COMPLETION_DURATION_SECONDS
  )
}

// Maximum records per page — prevents runaway queries on all paginated endpoints
export const MAX_PAGINATION_LIMIT = 100

// Cloudinary CDN URLs always start with this prefix.
// Validate on receipt to prevent arbitrary URLs being stored in the DB.
export function isCloudinaryUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidWalletAddress(address: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(address)
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function isValidReviewScore(score: unknown): score is 1 | 2 | 3 | 4 | 5 {
  return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5
}

/**
 * Validate gig deadline inputs. Safe to call on both server and mobile.
 * accept_deadline must be in the future.
 * accept_deadline, if provided, must be at least 1 hour from now to be meaningful.
 */
export function validateGigDeadlines(
  completion_duration_seconds: number,
  accept_deadline?: string | null,
): ValidationResult {
  if (!isValidCompletionDuration(completion_duration_seconds)) {
    return {
      valid: false,
      error: `completion_duration_seconds must be between ${MIN_COMPLETION_DURATION_SECONDS} and ${MAX_COMPLETION_DURATION_SECONDS}`,
    }
  }

  if (accept_deadline != null) {
    const accept = new Date(accept_deadline)
    if (isNaN(accept.getTime())) {
      return { valid: false, error: 'accept_deadline is not a valid date' }
    }
    if (accept <= new Date()) {
      return { valid: false, error: 'accept_deadline must be in the future' }
    }
  }

  return { valid: true }
}
