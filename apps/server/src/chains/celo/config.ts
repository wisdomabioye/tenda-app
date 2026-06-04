/**
 * CELO chain constants (stage-4-celo.md). Token addresses are the
 * canonical mainnet contracts — constants, not env (they never vary per
 * deployment); the escrow/Safe addresses ARE env (deployed per #49).
 */

export const CELO_CHAIN_ID = 'eip155:42220' as const

/** cUSD — the feeCurrency users pay gas in (governance-whitelisted). */
export const CELO_CUSD_ADDR = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const

/** Circle USDC on CELO. */
export const CELO_USDC_ADDR = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const

export const CELO_MIN_CONFIRMATIONS = 3
