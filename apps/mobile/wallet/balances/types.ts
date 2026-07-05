import type { ChainNamespace, ChainRegistryEntry } from '@tenda/shared'

/** A single asset's balance on one chain, in base units (string for exactness). */
export interface AssetBalance {
  assetId: string
  symbol: string
  /** Base-unit amount (lamports / wei / token base units) as a decimal string. */
  amountRaw: string
  decimals: number
  isStable: boolean
}

/**
 * Reads on-chain balances for one wallet on one chain. Implemented per
 * namespace (solana / eip155) and registered in `READERS`, adding a chain
 * family is one new reader, no call-site change (the "pluggable" requirement).
 */
export interface BalanceReader {
  read(address: string, chain: ChainRegistryEntry): Promise<AssetBalance[]>
}

/** A wallet's balance on a specific chain, as surfaced to the wallet screen. */
export interface WalletChainBalance {
  chainId: string
  namespace: ChainNamespace
  displayName: string
  address: string
  /** The chain's gig stablecoin (USDC), if the wallet holds any / it exists. */
  usdc: AssetBalance | null
  /** The chain's native gas token (SOL / ETH / CELO). */
  native: AssetBalance | null
}
