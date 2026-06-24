/**
 * Chain adapter registry. The rest of the server resolves an adapter from
 * `escrow.chain_id` via `chainRegistry.get(chain_id)` — no chain-namespace
 * branching outside this folder.
 *
 * Adapters are built generically from the ACTIVE chain secrets (one entry per
 * configured chain) against the shared CHAIN_MANIFEST: `namespace` picks the
 * adapter, `gasPolicy` picks the dep wiring (supplied by the plugin via the
 * dep factory), and confirmations / feeCurrency come from the manifest. Adding
 * a chain is a manifest entry + its env secrets — no edit here.
 */

import {
  CHAIN_MANIFEST,
  chainById,
  feeCurrencyAddress,
  type ChainManifestEntry,
} from '@tenda/shared'
import { solanaAdapter, type SolanaAdapterDeps } from '@server/chains/solana'
import { evmAdapter, type EvmAdapterDeps } from '@server/chains/evm'
import type { ResolvedChainSecret, EvmChainSecret } from '@server/chains/secrets'
import type { ChainAdapter, ChainId, ChainRegistry } from '@server/chains/types'
import { deriveChainNamespace, verifyWalletSignature } from '@server/lib/wallet-signature'

/**
 * Per-chain dependency factory. The plugin implements this (it owns DB access
 * for the wallet/asset resolvers and the sponsorship/paymaster wiring); the
 * builder stays a pure function over secrets + manifest + this factory.
 */
export interface AdapterDepsFactory {
  solana(chainId: ChainId): SolanaAdapterDeps
  evm(chainId: ChainId, secret: EvmChainSecret, entry: ChainManifestEntry): EvmAdapterDeps
}

/** A feeCurrency chain's stable-gas token address — guaranteed by the manifest. */
function requireFeeCurrency(entry: ChainManifestEntry): `0x${string}` {
  const addr = feeCurrencyAddress(entry)
  if (addr === null) {
    // Unreachable: assertManifestValid enforces feeCurrency resolves an address.
    throw new Error(`chain ${entry.id} has gasPolicy feeCurrency but no token address`)
  }
  return addr as `0x${string}`
}

/**
 * Build one adapter per active chain secret. Pure over its inputs (the factory
 * carries the side-effecting deps), so it is unit-testable with stub deps.
 */
export function buildAdapters(
  secrets: ReadonlyMap<string, ResolvedChainSecret>,
  deps: AdapterDepsFactory,
): ChainAdapter[] {
  const adapters: ChainAdapter[] = []
  for (const secret of secrets.values()) {
    const entry = chainById(secret.chainId)
    if (secret.namespace === 'solana') {
      adapters.push(
        solanaAdapter({
          chain_id: secret.chainId,
          rpc_url: secret.rpcUrl,
          deps: deps.solana(secret.chainId),
        }),
      )
    } else {
      adapters.push(
        evmAdapter({
          chain_id: secret.chainId,
          rpc_url: secret.rpcUrl,
          escrow_contract: secret.escrow as `0x${string}`,
          min_confirmations: entry.minConfirmations,
          ...(entry.gasPolicy === 'feeCurrency' ? { fee_currency: requireFeeCurrency(entry) } : {}),
          deps: deps.evm(secret.chainId, secret, entry),
        }),
      )
    }
  }
  return adapters
}

/**
 * Wrap built adapters in the registry surface. Throws on a duplicate chain id
 * so a manifest/secret mistake fails at boot rather than at first request.
 */
export function buildChainRegistry(adapters: readonly ChainAdapter[]): ChainRegistry {
  const byId = new Map<ChainId, ChainAdapter>()
  for (const adapter of adapters) {
    if (byId.has(adapter.chain_id)) {
      throw new Error(`duplicate chain registration: ${adapter.chain_id}`)
    }
    byId.set(adapter.chain_id, adapter)
  }

  return {
    get(chain_id) {
      const adapter = byId.get(chain_id)
      if (adapter === undefined) {
        throw new Error(`no adapter registered for chain_id '${chain_id}'`)
      }
      return adapter
    },
    has(chain_id) {
      return byId.has(chain_id)
    },
    list() {
      return [...byId.values()]
    },
    verifyAuthSig(chain_id, args) {
      // Namespace-dispatched, NOT `byId.get` — login must work for a supported
      // namespace even if that chain isn't provisioned on this deployment.
      return verifyWalletSignature(deriveChainNamespace(chain_id), args)
    },
  }
}

/** The manifest's paymaster-managed chain ids — used by sponsorship wiring. */
export const PAYMASTER_CHAIN_IDS: readonly string[] = CHAIN_MANIFEST.filter(
  (c) => c.gasPolicy === 'paymaster',
).map((c) => c.id)
