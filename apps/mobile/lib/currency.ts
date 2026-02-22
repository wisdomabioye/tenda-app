const LAMPORTS_PER_SOL = 1_000_000_000

export interface PaymentDisplay {
  naira: number
  sol: number
}

/**
 * Convert payment_lamports to display values (SOL + NGN equivalent).
 * Pass the current SOL/NGN rate from useExchangeRateStore().
 */
export function toPaymentDisplay(paymentLamports: number, solToNgn: number): PaymentDisplay {
  const sol = paymentLamports / LAMPORTS_PER_SOL
  const naira = sol * solToNgn
  return { naira, sol }
}

/** Format lamports as a SOL string, e.g. "0.05 SOL" */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL
  return `${sol.toLocaleString('en-NG', { maximumFractionDigits: 4 })} SOL`
}

/** Format naira amount, e.g. "₦120,000" */
export function formatNaira(amount: number): string {
  return amount.toLocaleString('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  })
}
