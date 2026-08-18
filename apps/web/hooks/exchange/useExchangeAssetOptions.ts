/**
 * Web port of apps/mobile/hooks/useExchangeAssetOptions.ts: the
 * exchange-tradable assets (from the shared manifest queries) the user
 * can actually sell — i.e. on a chain whose namespace they have a
 * VERIFIED linked wallet for. Web has no persistent session address (the
 * live connection belongs to the adapter), so resolution runs over the
 * linked list alone — the same `pickWalletAddress` dispatch signs with.
 */
import { useEffect, useMemo } from 'react'
import { exchangeAssetsByChain, pickWalletAddress } from '@tenda/shared'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { useAuthStore } from '@/stores/auth.store'

export interface ExchangeAssetOption {
  chainId: string
  assetId: string
  symbol: string
  decimals: number
  chainName: string
  walletAddress: string
}

export function useExchangeAssetOptions(): ExchangeAssetOption[] {
  const chains = useChainRegistryStore((s) => s.chains)
  const ensureLoaded = useChainRegistryStore((s) => s.ensureLoaded)
  const wallets = useAuthStore((s) => s.wallets)
  const ensureWallets = useAuthStore((s) => s.ensureWallets)

  // This hook's answer depends on BOTH the chain registry and the linked
  // wallets, so it loads both rather than waiting for a neighbour to.
  // Measured: the sell surface has neither a chain-chip row nor the wallet
  // screen's loader, so its options stayed empty forever and the page told a
  // reader with a linked wallet to link one. Both ensures de-dupe, so the
  // surfaces that already load them are unaffected.
  useEffect(() => {
    void ensureLoaded()
    void ensureWallets()
  }, [ensureLoaded, ensureWallets])

  return useMemo(() => {
    if (chains === null) return []
    const options: ExchangeAssetOption[] = []
    for (const chain of chains) {
      const walletAddress = pickWalletAddress(chain.namespace, null, wallets)
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
  }, [chains, wallets])
}
