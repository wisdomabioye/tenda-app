import { CURRENCY_META, type SupportedCurrency } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

export interface PaymentDisplay {
  fiat: number
  sol: number
}

/**
 * Convert payment_lamports to display values (SOL + fiat equivalent).
 * Pass the rate for the user's preferred currency from useExchangeRateStore().
 * Returns fiat = 0 if rate is not yet available (rates = null).
 */
export function toPaymentDisplay(paymentLamports: number, rate: number | null): PaymentDisplay {
  const sol = paymentLamports / LAMPORTS_PER_SOL
  const fiat = rate != null && rate > 0 ? sol * rate : 0
  return { fiat, sol }
}

/** Format lamports as a SOL string, e.g. "0.05 SOL" */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL
  return `${sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`
}

/** Format a SOL amount (already in SOL, not lamports) as a display string, e.g. "0.05 SOL" */
export function formatSolDisplay(sol: number): string {
  return `${sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`
}

/** Format a fiat amount in the given currency, e.g. formatFiat(85000, 'NGN') → "₦85,000" */
export function formatFiat(amount: number, currency: SupportedCurrency): string {
  const { locale } = CURRENCY_META[currency]
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}
