import type { ChainRegistryEntry } from '@tenda/shared'
import { evmPublicRpcUrl } from '@tenda/shared'
import type { AssetBalance, BalanceReader } from './types'
import { RPC_TIMEOUT_MS } from './withTimeout'

/** ERC-20 `balanceOf(address)` selector. */
const BALANCE_OF_SELECTOR = '0x70a08231'

/**
 * One JSON-RPC call returning the hex `result`, or null on any error/miss.
 * Bounded by an AbortController timeout so a hung endpoint can't strand the
 * wallet screen's loading state (see withTimeout for why allSettled needs this).
 */
async function evmRpc(rpcUrl: string, method: string, params: unknown[]): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'result' in body) {
      const result = (body as { result: unknown }).result
      return typeof result === 'string' ? result : null
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Hex quantity (e.g. `0x1a2b`) → base-unit decimal string; 0 on empty/invalid. */
function hexToDecimalString(hex: string | null): string {
  if (hex === null || hex === '0x' || hex === '') return '0'
  try {
    return BigInt(hex).toString()
  } catch {
    return '0'
  }
}

/** Left-pad a 20-byte address to a 32-byte ABI word (no 0x). */
function addressWord(address: string): string {
  return address.replace(/^0x/, '').toLowerCase().padStart(64, '0')
}

export const evmBalanceReader: BalanceReader = {
  async read(address: string, chain: ChainRegistryEntry): Promise<AssetBalance[]> {
    const rpcUrl = evmPublicRpcUrl(chain.id)
    if (rpcUrl === null) return []

    const results = await Promise.allSettled(
      chain.assets.map(async (asset): Promise<AssetBalance> => {
        const amountRaw =
          asset.token_address === null
            ? hexToDecimalString(await evmRpc(rpcUrl, 'eth_getBalance', [address, 'latest']))
            : hexToDecimalString(
                await evmRpc(rpcUrl, 'eth_call', [
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
