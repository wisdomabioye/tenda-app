export {
  MIN_PAYMENT_LAMPORTS,
  MAX_PAYMENT_LAMPORTS,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  MAX_DISPUTE_REASON_LENGTH,
  MIN_COMPLETION_DURATION_SECONDS,
  MAX_COMPLETION_DURATION_SECONDS,
  isValidPaymentLamports,
  isValidCompletionDuration,
  isValidWalletAddress,
  validateGigDeadlines,
} from './validation'
export type { ValidationResult } from './validation'
