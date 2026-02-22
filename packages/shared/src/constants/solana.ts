/** Estimated base transaction fee on Solana (lamports). Used for pre-flight balance checks. */
export const SOLANA_TX_FEE_LAMPORTS = 5_000n

/**
 * Formats a Solana cluster name as a CAIP-2 chain identifier.
 * Used in auth messages (mobile) and validated on the server so both sides
 * share the same format without hardcoding the string in either place.
 *
 * Examples:
 *   solanaChainId('devnet')       → 'solana:devnet'
 *   solanaChainId('mainnet-beta') → 'solana:mainnet-beta'
 */
export function solanaChainId(network: string): string {
  return `solana:${network}`
}
