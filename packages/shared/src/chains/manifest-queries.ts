/**
 * Manifest lookups — pure, derived reads over CHAIN_MANIFEST. Kept out of
 * manifest.ts so the data table and its import-time integrity guard stay one
 * focused module. Dependency is strictly one-way: this imports the manifest,
 * never the reverse (manifest.ts holds only the self-contained invariants it
 * needs at import time — isNativeAsset / feeCurrencyAddress).
 */

import { CHAIN_MANIFEST, type ChainManifestEntry } from './manifest'

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
 * no gigs. Derived from the asset list — the SINGLE source of the gig-asset
 * policy (the server's assertGigAsset and the mobile chain picker both read it).
 */
export function gigAssetByChain(id: string): string | null {
  return findChain(id)?.assets.find((a) => a.roles.includes('gig'))?.id ?? null
}

/**
 * Exchange-tradable asset ids for a chain (USDC + the native token, per the
 * manifest roles), or an empty list for an unknown chain. SINGLE source shared
 * by the server's assertExchangeAsset guard and the mobile asset picker, so
 * client options and the guard can never disagree.
 */
export function exchangeAssetsByChain(id: string): string[] {
  return findChain(id)?.assets.filter((a) => a.roles.includes('exchange')).map((a) => a.id) ?? []
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
