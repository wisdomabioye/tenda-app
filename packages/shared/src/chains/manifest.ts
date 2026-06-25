/**
 * Chain manifest — the SINGLE source of truth for every public, deployment-
 * independent fact about a supported chain. Imported by the server (registry,
 * seeder, sponsor, webhooks) and mobile (asset/chain metadata). Adding a chain
 * in an already-supported family (any Solana cluster, any EVM L2) is ONE entry
 * here plus its per-deployment secrets — no other code changes.
 *
 * Split of responsibilities (everything that is NOT here):
 *   - SECRETS / endpoints (RPC URL, deployed contract/treasury addresses,
 *     webhook secrets) are per-deployment → flat env vars, loaded by the
 *     server's `chains/secrets.ts`. The manifest carries none of them.
 *   - Asset DISPLAY metadata (symbol/decimals/is_stable) stays in ASSET_META,
 *     keyed by asset id; the manifest references asset ids and never restates it.
 *
 * Three orthogonal fields, each with one job (do not conflate):
 *   - `namespace` → which adapter runs it AND which secret schema it reads.
 *   - `gasPolicy` → how gas is covered (drives the registry's dep wiring).
 *   - `family`    → network group; a deployment runs at most ONE chain per
 *                   family (Base mainnet XOR Base Sepolia), enforced by the
 *                   secret loader. This also prevents the global `assets.id`
 *                   PK (e.g. `USDC_BASE`) colliding across two active networks.
 */

import type { ChainNamespace } from '../db/schema/chains'
import { ASSET_META } from '../constants/assets'

/** How gas is paid on a chain — selects the registry's per-chain dep wiring. */
export type GasPolicy =
  | 'native-seed' // Solana: a one-time native-SOL grant on first wallet link.
  | 'paymaster' //   BASE-style: ERC-4337 paymaster sponsors the first txs.
  | 'feeCurrency' // CELO-style: gas paid in a stable via EIP-2930 feeCurrency.
  | 'none' //        User pays gas in the native token; no abstraction.

/** What an asset is used for. Native gas tokens are `token: null` (see below). */
export type AssetRole = 'gig' | 'exchange'

/**
 * One asset on a chain. `token` is the on-chain contract/mint, or `null` for
 * the native gas token. `fromSecret` names a per-deployment secret key that
 * supplies the address instead (Solana's USDC mint differs per cluster and is
 * not canonical on devnet, so it can't be a manifest constant) — when set, the
 * asset is seeded only if that secret is configured. An asset is the chain's
 * NATIVE token iff `token === null && fromSecret === undefined`.
 */
export interface ChainAsset {
  /** Asset-registry id; MUST exist in ASSET_META. */
  id: string
  role: AssetRole
  token: string | null
  fromSecret?: string
}

export interface ChainManifestEntry {
  /** CAIP-2 id, e.g. `'eip155:8453'`, `'solana:devnet'`. */
  id: string
  namespace: ChainNamespace
  /** Network group; one active chain per family per deployment. */
  family: string
  kind: 'mainnet' | 'testnet'
  displayName: string
  /** Reorg-safety margin before a receipt counts as confirmed. */
  minConfirmations: number
  /**
   * Public, client-safe JSON-RPC endpoint — used for read-only client calls
   * (the mobile wallet screen's balance reads) and the AppKit connector.
   * Required for EVM chains (validated below); Solana clients derive their RPC
   * from `clusterApiUrl`. This is NOT the server's RPC: the deployment's private
   * / keyed endpoint stays a secret (`CHAIN_<id>_RPC_URL`, secrets.ts), so
   * metered backend traffic never leaks to clients.
   */
  publicRpcUrl?: string
  gasPolicy: GasPolicy
  /**
   * Asset id whose token address funds gas, for `gasPolicy: 'feeCurrency'`.
   * Required iff the policy is feeCurrency; the address is read from that
   * asset's `token` (single source — never restated).
   */
  feeCurrency?: string
  assets: ChainAsset[]
}

/**
 * The supported chains. Token addresses are canonical, publicly published
 * contracts (verifiable on-chain); Solana USDC mints come from secrets
 * (`fromSecret: 'usdcMint'`) because the devnet faucet mint is not canonical.
 */
export const CHAIN_MANIFEST: readonly ChainManifestEntry[] = [
  {
    id: 'solana:mainnet',
    namespace: 'solana',
    family: 'solana',
    kind: 'mainnet',
    displayName: 'Solana',
    minConfirmations: 1,
    gasPolicy: 'native-seed',
    assets: [
      { id: 'SOL', role: 'exchange', token: null },
      { id: 'USDC_SOL', role: 'gig', token: null, fromSecret: 'usdcMint' },
    ],
  },
  {
    id: 'solana:devnet',
    namespace: 'solana',
    family: 'solana',
    kind: 'testnet',
    displayName: 'Solana Devnet',
    minConfirmations: 1,
    gasPolicy: 'native-seed',
    assets: [
      { id: 'SOL_DEVNET', role: 'exchange', token: null },
      { id: 'USDC_SOL', role: 'gig', token: null, fromSecret: 'usdcMint' },
    ],
  },
  {
    id: 'eip155:8453',
    namespace: 'eip155',
    family: 'base',
    kind: 'mainnet',
    displayName: 'BASE',
    minConfirmations: 5,
    publicRpcUrl: 'https://mainnet.base.org',
    gasPolicy: 'paymaster',
    assets: [
      // Circle USDC on BASE (verified in repo: apps/server/.env.example).
      { id: 'USDC_BASE', role: 'gig', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      { id: 'ETH_BASE', role: 'exchange', token: null },
    ],
  },
  {
    id: 'eip155:84532',
    namespace: 'eip155',
    family: 'base',
    kind: 'testnet',
    displayName: 'Base Sepolia',
    minConfirmations: 5,
    publicRpcUrl: 'https://sepolia.base.org',
    gasPolicy: 'paymaster',
    assets: [
      // Circle's published USDC on Base Sepolia — CONFIRM before activating.
      { id: 'USDC_BASE', role: 'gig', token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
      { id: 'ETH_BASE', role: 'exchange', token: null },
    ],
  },
  {
    id: 'eip155:42220',
    namespace: 'eip155',
    family: 'celo',
    kind: 'mainnet',
    displayName: 'CELO',
    minConfirmations: 3,
    publicRpcUrl: 'https://forno.celo.org',
    gasPolicy: 'feeCurrency',
    feeCurrency: 'cUSD',
    assets: [
      // Verified in repo: apps/server/src/chains/celo/config.ts.
      { id: 'USDC_CELO', role: 'gig', token: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' },
      { id: 'cUSD', role: 'exchange', token: '0x765DE816845861e75A25fCA122bb6898B8B1282a' },
      { id: 'CELO', role: 'exchange', token: null },
    ],
  },
]

/** True iff the asset is the chain's native gas token (no contract, no secret). */
export function isNativeAsset(asset: ChainAsset): boolean {
  return asset.token === null && asset.fromSecret === undefined
}

/** Look up a chain by CAIP-2 id; throws on unknown so callers fail loud. */
export function chainById(id: string): ChainManifestEntry {
  const entry = CHAIN_MANIFEST.find((c) => c.id === id)
  if (entry === undefined) {
    throw new Error(`unknown chain id '${id}' (not in CHAIN_MANIFEST)`)
  }
  return entry
}

/** Non-throwing lookup for membership checks. */
export function findChain(id: string): ChainManifestEntry | undefined {
  return CHAIN_MANIFEST.find((c) => c.id === id)
}

/**
 * The gig-eligible (USDC) asset id for a chain, or null if the chain carries
 * no gigs. Derived from the asset list — the single source — superseding the
 * old standalone GIG_ASSET_BY_CHAIN map.
 */
export function gigAssetByChain(id: string): string | null {
  return findChain(id)?.assets.find((a) => a.role === 'gig')?.id ?? null
}

/**
 * Client-safe public RPC URL for an EVM chain id, or null if unknown / non-EVM.
 * The single source for client-side balance reads — callers must not hardcode
 * RPC endpoints. Non-throwing (a registry chain with no manifest match simply
 * yields no reads rather than crashing the screen).
 */
export function evmPublicRpcUrl(id: string): string | null {
  return findChain(id)?.publicRpcUrl ?? null
}

/** Throwing variant for call sites that require the URL (manifest guarantees it). */
export function requireEvmPublicRpcUrl(id: string): string {
  const url = evmPublicRpcUrl(id)
  if (url === null) {
    throw new Error(`no publicRpcUrl for EVM chain '${id}' (not in CHAIN_MANIFEST)`)
  }
  return url
}

/** Resolve the feeCurrency token address from the chain's asset list. */
export function feeCurrencyAddress(entry: ChainManifestEntry): string | null {
  if (entry.feeCurrency === undefined) return null
  const asset = entry.assets.find((a) => a.id === entry.feeCurrency)
  return asset?.token ?? null
}

/**
 * Assert the data integrity of a manifest. A malformed manifest is a
 * programming error, not a runtime condition, so this runs once at import on
 * CHAIN_MANIFEST (fail-fast, everywhere the module loads) and is independently
 * unit-tested with malformed inputs. Throws on the first violation.
 */
export function assertManifestValid(entries: readonly ChainManifestEntry[]): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`CHAIN_MANIFEST: duplicate chain id '${entry.id}'`)
    }
    seen.add(entry.id)

    for (const asset of entry.assets) {
      if (ASSET_META[asset.id] === undefined) {
        throw new Error(`CHAIN_MANIFEST: asset '${asset.id}' on '${entry.id}' missing from ASSET_META`)
      }
    }
    if (entry.assets.filter(isNativeAsset).length !== 1) {
      throw new Error(`CHAIN_MANIFEST: '${entry.id}' must have exactly one native asset`)
    }
    if (entry.namespace === 'eip155' && (entry.publicRpcUrl ?? '').length === 0) {
      throw new Error(`CHAIN_MANIFEST: EVM chain '${entry.id}' must set a publicRpcUrl`)
    }
    if ((entry.gasPolicy === 'feeCurrency') !== (entry.feeCurrency !== undefined)) {
      throw new Error(`CHAIN_MANIFEST: '${entry.id}' feeCurrency must be set iff gasPolicy is 'feeCurrency'`)
    }
    if (entry.feeCurrency !== undefined && feeCurrencyAddress(entry) === null) {
      throw new Error(`CHAIN_MANIFEST: '${entry.id}' feeCurrency '${entry.feeCurrency}' has no token address`)
    }
  }
}

assertManifestValid(CHAIN_MANIFEST)
