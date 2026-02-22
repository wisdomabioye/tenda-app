/**
 * Compute the platform fee for a given payment amount using BigInt arithmetic
 * to avoid overflow and TypeError from bigint × number operations.
 */
export function computePlatformFee(paymentLamports: bigint, feeBps: number): number {
  return Number(paymentLamports * BigInt(feeBps) / 10_000n)
}
