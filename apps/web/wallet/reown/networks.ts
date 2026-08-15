/**
 * Reown ↔ CHAIN_MANIFEST bridge (ported from apps/admin/providers/reown/
 * networks.ts — keep the two in lockstep; the manifest-coverage test in
 * __tests__/networks.test.ts turns silent drift into a red build). The
 * manifest is the single source of which chains exist; this file maps each
 * manifest CAIP-2 id to its Reown `AppKitNetwork`. A missing mapping is a
 * deploy-time gap, so it fails loud at module init rather than silently
 * dropping a chain from the connect modal.
 */
import { base, baseSepolia, celo, celoSepolia, solana, solanaDevnet } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { CHAIN_MANIFEST } from '@tenda/shared'

const NETWORK_BY_CHAIN_ID: Record<string, AppKitNetwork> = {
  'solana:mainnet': solana,
  'solana:devnet': solanaDevnet,
  'eip155:8453': base,
  'eip155:84532': baseSepolia,
  'eip155:42220': celo,
  'eip155:11142220': celoSepolia,
}

type NonEmpty = [AppKitNetwork, ...AppKitNetwork[]]

function toNonEmpty(networks: AppKitNetwork[], label: string): NonEmpty {
  const [first, ...rest] = networks
  if (first === undefined) throw new Error(`reown: no ${label} networks configured`)
  return [first, ...rest]
}

/** Reown network for a manifest chain, or throw if the mapping is missing. */
function networkFor(chainId: string): AppKitNetwork {
  const network = NETWORK_BY_CHAIN_ID[chainId]
  if (network === undefined) {
    throw new Error(`reown: no AppKitNetwork mapped for manifest chain '${chainId}'`)
  }
  return network
}

/** Every manifest chain, as Reown networks — the AppKit modal's full set. */
export const appKitNetworks: NonEmpty = toNonEmpty(
  CHAIN_MANIFEST.map((chain) => networkFor(chain.id)),
  'AppKit',
)

/** EVM-only subset — what the Wagmi adapter is constructed with. */
export const evmNetworks: NonEmpty = toNonEmpty(
  CHAIN_MANIFEST.filter((chain) => chain.namespace === 'eip155').map((chain) => networkFor(chain.id)),
  'EVM',
)

/** Reown network for a CAIP-2 id (used to switch the wallet before signing). */
export function appKitNetworkForChain(chainId: string): AppKitNetwork {
  return networkFor(chainId)
}
