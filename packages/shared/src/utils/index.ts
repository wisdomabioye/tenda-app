export * from './gig-utils'
export { computePlatformFee } from './fees'

export {
  MIN_PAYMENT_LAMPORTS,
  MAX_PAYMENT_LAMPORTS,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  MAX_DISPUTE_REASON_LENGTH,
  MIN_COMPLETION_DURATION_SECONDS,
  MAX_COMPLETION_DURATION_SECONDS,
  MAX_PAGINATION_LIMIT,
  MAX_REVIEW_COMMENT_LENGTH,
  isValidPaymentLamports,
  isValidCompletionDuration,
  isValidWalletAddress,
  isValidReviewScore,
  isCloudinaryUrl,
  isValidLatitude,
  isValidLongitude,
  validateGigDeadlines,
} from './validation'
export type { ValidationResult } from './validation'
