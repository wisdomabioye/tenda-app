export const ErrorCode = {
  // Auth
  INVALID_WALLET_ADDRESS:        'INVALID_WALLET_ADDRESS',
  INVALID_SIGNATURE:             'INVALID_SIGNATURE',
  UNAUTHORIZED:                  'UNAUTHORIZED',
  FORBIDDEN:                     'FORBIDDEN',
  // Users
  USER_NOT_FOUND:                'USER_NOT_FOUND',
  USER_SUSPENDED:                'USER_SUSPENDED',
  // Gigs
  GIG_NOT_FOUND:                 'GIG_NOT_FOUND',
  GIG_WRONG_STATUS:              'GIG_WRONG_STATUS',
  CANNOT_ACCEPT_OWN_GIG:         'CANNOT_ACCEPT_OWN_GIG',
  ACCEPT_DEADLINE_PASSED:        'ACCEPT_DEADLINE_PASSED',
  COMPLETION_DEADLINE_PASSED:    'COMPLETION_DEADLINE_PASSED',
  // Disputes / grace period
  DISPUTE_ALREADY_EXISTS:        'DISPUTE_ALREADY_EXISTS',
  GRACE_PERIOD_EXPIRED:          'GRACE_PERIOD_EXPIRED',
  // CO7 — mediation threads (claim-based assignment)
  DISPUTE_ALREADY_CLAIMED:       'DISPUTE_ALREADY_CLAIMED',
  DISPUTE_RESOLVED:              'DISPUTE_RESOLVED',
  // Reviews
  REVIEW_ALREADY_EXISTS:         'REVIEW_ALREADY_EXISTS',
  REVIEW_NOT_ALLOWED:            'REVIEW_NOT_ALLOWED',
  // Blockchain
  SIGNATURE_NOT_FINALIZED:       'SIGNATURE_NOT_FINALIZED',
  SIGNATURE_VERIFICATION_FAILED: 'SIGNATURE_VERIFICATION_FAILED',
  DUPLICATE_SIGNATURE:           'DUPLICATE_SIGNATURE',
  ESCROW_NOT_FUNDED:             'ESCROW_NOT_FUNDED',
  ESCROW_MISMATCH:               'ESCROW_MISMATCH',
  // Moderation
  CONTENT_MODERATED:             'CONTENT_MODERATED',
  CANNOT_REPORT_SELF:            'CANNOT_REPORT_SELF',
  // Escrow state machine (v2 — used by lib/escrow.ts state-transition guards)
  ESCROW_WRONG_STATUS:           'ESCROW_WRONG_STATUS',
  ESCROW_WRONG_CALLER:           'ESCROW_WRONG_CALLER',
  ESCROW_DEADLINE_PASSED:        'ESCROW_DEADLINE_PASSED',
  ESCROW_DEADLINE_NOT_REACHED:   'ESCROW_DEADLINE_NOT_REACHED',
  ESCROW_INVALID_ASSET:          'ESCROW_INVALID_ASSET',
  // Auth nonces (v2 — used by lib/nonce.ts; replaces ±5min timestamp window)
  AUTH_NONCE_UNKNOWN:            'AUTH_NONCE_UNKNOWN',
  AUTH_NONCE_REPLAY:             'AUTH_NONCE_REPLAY',
  AUTH_NONCE_EXPIRED:            'AUTH_NONCE_EXPIRED',
  // Stage 7 — reputation restrictions
  USER_RESTRICTED:               'USER_RESTRICTED',
  ACCOUNT_UNDER_REVIEW:          'ACCOUNT_UNDER_REVIEW',
  // Stage 1 — onboarding (phone OTP, multi-wallet management)
  PROFILE_INCOMPLETE:            'PROFILE_INCOMPLETE',
  WALLET_IN_USE:                 'WALLET_IN_USE',
  OTP_RATE_LIMITED:              'OTP_RATE_LIMITED',
  OTP_INVALID:                   'OTP_INVALID',
  OTP_EXPIRED:                   'OTP_EXPIRED',
  PHONE_ALREADY_VERIFIED:        'PHONE_ALREADY_VERIFIED',
  // #84–#87 — admin email-OTP login (admin_users registry)
  EMAIL_IN_USE:                  'EMAIL_IN_USE',
  // Stage 8 — fiat rails
  QUOTE_EXPIRED:                 'QUOTE_EXPIRED',
  FIAT_RAILS_DISABLED:           'FIAT_RAILS_DISABLED',
  PROVIDER_UNAVAILABLE:          'PROVIDER_UNAVAILABLE',
  BANK_ACCOUNT_INVALID:          'BANK_ACCOUNT_INVALID',
  // Generic
  SERVICE_UNAVAILABLE:           'SERVICE_UNAVAILABLE',
  NOT_FOUND:                     'NOT_FOUND',
  VALIDATION_ERROR:              'VALIDATION_ERROR',
  INTERNAL_ERROR:                'INTERNAL_ERROR',
} as const

export type ErrorCode = keyof typeof ErrorCode
