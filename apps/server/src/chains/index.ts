/**
 * Chain adapter registry. The rest of the server resolves an adapter from
 * `escrow.chain_id` via `chainRegistry.get(chain_id)` — no chain-namespace
 * branching outside this folder.
 *
 * Stage 0 registers exactly one Solana chain — whichever matches
 * `SOLANA_NETWORK` (a deployment points its RPC at one network at a time).
 * EVM adapters land in Stage 3 (BASE) and Stage 4 (CELO) by adding more
 * `register()` calls here; no other file changes.
 *
 * Construction is lazy: `buildChainRegistry(getConfig())` is called once at
 * server boot and cached on `fastify.chains` via the plugin (Stage 0 routes
 * import the cached registry, not raw factories).
 */

import { solanaAdapter, type SolanaAdapterDeps } from '@server/chains/solana'
import type { Config } from '@server/config'
import type { ChainAdapter, ChainId, ChainRegistry } from '@server/chains/types'

/**
 * Per-namespace adapter dependencies. The chains plugin constructs these
 * (it owns DB access for the wallet/asset resolvers); the registry stays a
 * pure factory over config + deps.
 */
export interface ChainRegistryDeps {
  solana: SolanaAdapterDeps
}

/**
 * Build the registry from config. Throws on duplicate registration so a
 * typo in the registration block fails at boot rather than at first
 * request.
 */
export function buildChainRegistry(config: Config, deps: ChainRegistryDeps): ChainRegistry {
  const adapters = new Map<ChainId, ChainAdapter>()

  function register(adapter: ChainAdapter): void {
    if (adapters.has(adapter.chain_id)) {
      throw new Error(`duplicate chain registration: ${adapter.chain_id}`)
    }
    adapters.set(adapter.chain_id, adapter)
  }

  // ---- Solana ---------------------------------------------------------
  // Same program_id + treasury reused across networks at launch; only RPC
  // URL differs per network. Explicit map (not a fallthrough) so an
  // unsupported value like SOLANA_NETWORK='testnet' fails at boot rather
  // than silently aliasing to devnet — testnet has no seeded `assets` rows.
  // `Partial<Record<string, ChainId>>` (vs `Record<...>`) so an unknown key
  // returns `ChainId | undefined` at the type level. Without this the
  // undefined check below would be flagged unreachable by stricter checkers
  // (the postgres `numeric` driver would still throw at runtime, but the
  // type system wouldn't tell us we need the guard). Closes open_issues.md S0-3.
  const SOLANA_CHAIN_ID_BY_NETWORK: Partial<Record<string, ChainId>> = {
    'mainnet-beta': 'solana:mainnet',
    devnet: 'solana:devnet',
  }
  const solanaChainId = SOLANA_CHAIN_ID_BY_NETWORK[config.SOLANA_NETWORK]
  if (solanaChainId === undefined) {
    throw new Error(
      `unsupported SOLANA_NETWORK='${config.SOLANA_NETWORK}' (expected 'mainnet-beta' or 'devnet')`,
    )
  }

  register(
    solanaAdapter({
      chain_id: solanaChainId,
      rpc_url: config.SOLANA_RPC_URL,
      deps: deps.solana,
    }),
  )

  return {
    get(chain_id) {
      const a = adapters.get(chain_id)
      if (a === undefined) {
        throw new Error(`no adapter registered for chain_id '${chain_id}'`)
      }
      return a
    },
    has(chain_id) {
      return adapters.has(chain_id)
    },
    list() {
      return [...adapters.values()]
    },
  }
}
