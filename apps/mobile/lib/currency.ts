const LAMPORTS_PER_SOL = 1_000_000_000

// TODO: Replace with real exchange rate from API/store
const MOCK_SOL_TO_NGN = 2_400_000 // ~₦2.4M per SOL (illustrative)

export interface PaymentDisplay {
  naira: number
  sol: number
}

/**
 * Convert payment_lamports to display values (SOL + NGN equivalent).
 * Conversion: lamports → SOL → NGN using current rate.
 * Replace MOCK_SOL_TO_NGN with a real rate from your exchange rate store.
 */
export function toPaymentDisplay(paymentLamports: number): PaymentDisplay {
  const sol = paymentLamports / LAMPORTS_PER_SOL
  const naira = sol * MOCK_SOL_TO_NGN
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
