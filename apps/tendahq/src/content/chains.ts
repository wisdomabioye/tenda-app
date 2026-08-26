/**
 * Chain registry for the landing — DERIVED from @tenda/shared CHAIN_MANIFEST
 * (the monorepo's single source of chain truth), so a chain added there shows
 * up across the landing with zero code changes here. Only marketing display
 * extras (brand colour, glyph, one-line pitch) live in this file, keyed by
 * manifest `family`.
 */

import { CHAIN_MANIFEST, nativeCurrencyOf, type GasPolicy } from '@tenda/shared/chains'
import { prose } from '@/lib/prose'

interface ChainDisplay {
  /** Marketing-cased name (manifest displayName is UPPER for some chains). */
  name: string
  /** Single-character mark used in badges and panels. */
  glyph: string
  /** Chain brand colour — the one place a per-chain hex is allowed. */
  color: string
  /** One-line positioning used on chain badges / ecosystem panels. */
  pitch: string
}

/** Display extras per manifest family. Add a row when a new family ships. */
const FAMILY_DISPLAY: Record<string, ChainDisplay> = {
  solana: {
    name: 'Solana',
    glyph: '◎',
    color: '#9945FF',
    pitch: 'Sub-second settlement, fees too small to notice.',
  },
  base: {
    name: 'Base',
    glyph: '●',
    color: '#0052FF',
    pitch: 'Coinbase’s L2 — USDC-native, built to onboard everyone.',
  },
  celo: {
    name: 'Celo',
    glyph: '◍',
    color: '#FCFF52',
    pitch: 'Mobile-first L2 where stablecoins pay their own gas.',
  },
}

export interface LandingChain {
  /** CAIP-2 id, e.g. `eip155:8453`. */
  id: string
  family: string
  name: string
  glyph: string
  color: string
  pitch: string
  /** CAIP-2 namespace — 'solana' | 'eip155'. Decides the wallet transport. */
  namespace: string
  gasPolicy: GasPolicy
  /** Native gas token symbol ('SOL', 'ETH', 'CELO'), from the manifest. */
  nativeSymbol: string
  explorerUrl?: string
}

/**
 * The chains the landing talks about: every MAINNET manifest entry, in
 * manifest order (Solana first). Testnet entries never surface in marketing.
 */
export const LANDING_CHAINS: readonly LandingChain[] = CHAIN_MANIFEST.filter(
  (entry) => entry.kind === 'mainnet',
).map((entry) => {
  const display = FAMILY_DISPLAY[entry.family]
  return {
    id: entry.id,
    family: entry.family,
    name: display?.name ?? entry.displayName,
    glyph: display?.glyph ?? '●',
    color: display?.color ?? 'var(--brand)',
    pitch: display?.pitch ?? '',
    namespace: entry.namespace,
    gasPolicy: entry.gasPolicy,
    nativeSymbol: nativeCurrencyOf(entry).symbol,
    explorerUrl: entry.explorerUrl,
  }
})

/** The mainnet chains running a given gas policy, in manifest order. */
export function chainsByGasPolicy(policy: GasPolicy): readonly LandingChain[] {
  return LANDING_CHAINS.filter((c) => c.gasPolicy === policy)
}

/** The distinct gas policies in play across the chains we ship on. */
export const ACTIVE_GAS_POLICIES: readonly GasPolicy[] = [
  ...new Set(LANDING_CHAINS.map((c) => c.gasPolicy)),
]

/** "Solana · Base · Celo" — the recurring network line, for stamps and metas. */
export const CHAIN_NAMES_LINE = LANDING_CHAINS.map((c) => c.name).join(' · ')

/**
 * "Solana, Base and Celo" — the same list as a noun phrase, for running prose
 * (the legal disclaimer, FAQ answers) where middots read as a UI stamp rather
 * than a sentence. Separate from CHAIN_NAMES_LINE so prose and stamps can both
 * be derived instead of one of them being retyped by hand every time a chain
 * is added.
 */
export const CHAIN_NAMES_PROSE = prose(LANDING_CHAINS.map((c) => c.name))

/**
 * Chain names grouped by CAIP-2 namespace, as prose.
 *
 * The wallet story splits on namespace, not on chain: Solana connects through
 * Mobile Wallet Adapter, every eip155 chain through WalletConnect. Deriving
 * the two lists means a new EVM L2 joins the WalletConnect sentence by itself.
 */
export function chainNamesProseByNamespace(namespace: string): string {
  return prose(LANDING_CHAINS.filter((c) => c.namespace === namespace).map((c) => c.name))
}

/** "Base and Celo" — the EVM chains, for the WalletConnect half of the story. */
export const EVM_CHAIN_NAMES_PROSE = chainNamesProseByNamespace('eip155')

/** Trailing badge after the chain list. */
export const MORE_CHAINS_LABEL = 'More coming'

export function chainByFamily(family: string): LandingChain | undefined {
  return LANDING_CHAINS.find((c) => c.family === family)
}
