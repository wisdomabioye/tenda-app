import { useMemo } from 'react'
import { exchangeAssetsByChain } from '@tenda/shared'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { useAuthStore } from '@/stores/auth.store'

/** One sellable (chain, asset) pair the user has a wallet for. */
export interface ExchangeAssetOption {
  chainId: string
  assetId: string
  symbol: string
  decimals: number
  chainName: string
  /** The user's wallet address on this chain (quote/escrow creator). */
  walletAddress: string
}

/**
 * The exchange-tradable assets (USDC + native per chain, from the shared
 * manifest) that the user can actually sell — i.e. on a chain whose namespace
 * they have a linked wallet for. Solana chains resolve to the Solana address,
 * EVM chains to the EVM address; a chain with no wallet is omitted.
 */
export function useExchangeAssetOptions(): ExchangeAssetOption[] {
  const chains = useChainRegistryStore((s) => s.chains)
  const solAddress = useAuthStore((s) => s.walletAddress)
  const evmAddress = useAuthStore((s) => s.evmAddress)

  return useMemo(() => {
    if (chains === null) return []
    const options: ExchangeAssetOption[] = []
    for (const chain of chains) {
      const walletAddress = chain.namespace === 'solana' ? solAddress : evmAddress
      if (walletAddress === null) continue
      const eligible = new Set(exchangeAssetsByChain(chain.id))
      for (const asset of chain.assets) {
        if (!eligible.has(asset.id)) continue
        options.push({
          chainId: chain.id,
          assetId: asset.id,
          symbol: asset.symbol,
          decimals: asset.decimals,
          chainName: chain.display_name,
          walletAddress,
        })
      }
    }
    return options
  }, [chains, solAddress, evmAddress])
}
