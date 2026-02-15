// TODO: Replace with real exchange rate from API/store
const MOCK_SOL_TO_NGN = 30_000

export interface PaymentDisplay {
  naira: number
  sol: number
}

/**
 * Convert a mock payment amount (kobo) to display values.
 * Replace this with real lamport→SOL + rate lookup when API is wired up.
 */
export function toPaymentDisplay(paymentKobo: number): PaymentDisplay {
  const naira = paymentKobo / 100
  const sol = naira / MOCK_SOL_TO_NGN
  return { naira, sol }
}
