import type { ChainRegistryEntry } from '@tenda/shared'
import { evmPublicRpcUrl } from '@tenda/shared'
import type { AssetBalance, BalanceReader } from './types'
import { addressWord, evmRpcString, hexToDecimalString } from '../evm-rpc'

/** ERC-20 `balanceOf(address)` selector. */
const BALANCE_OF_SELECTOR = '0x70a08231'

export const evmBalanceReader: BalanceReader = {
  async read(address: string, chain: ChainRegistryEntry): Promise<AssetBalance[]> {
    const rpcUrl = evmPublicRpcUrl(chain.id)
    if (rpcUrl === null) return []

    const results = await Promise.allSettled(
      chain.assets.map(async (asset): Promise<AssetBalance> => {
        const amountRaw =
          asset.token_address === null
            ? hexToDecimalString(await evmRpcString(rpcUrl, 'eth_getBalance', [address, 'latest']))
            : hexToDecimalString(
                await evmRpcString(rpcUrl, 'eth_call', [
                  { to: asset.token_address, data: `${BALANCE_OF_SELECTOR}${addressWord(address)}` },
                  'latest',
                ]),
              )
        return {
          assetId: asset.id,
          symbol: asset.symbol,
          amountRaw,
          decimals: asset.decimals,
          isStable: asset.is_stable,
        }
      }),
    )
    // One failed asset read must not sink the others.
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  },
}
