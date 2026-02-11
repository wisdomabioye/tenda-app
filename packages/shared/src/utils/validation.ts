const MIN_PAYMENT = 100 // minimum payment in smallest unit
const MAX_PAYMENT = 100_000_000 // maximum payment in smallest unit

export const MAX_GIG_TITLE_LENGTH = 200
export const MAX_GIG_DESCRIPTION_LENGTH = 5000
export const MAX_DISPUTE_REASON_LENGTH = 1000

export function isValidPayment(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_PAYMENT && amount <= MAX_PAYMENT
}

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidWalletAddress(address: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(address)
}
