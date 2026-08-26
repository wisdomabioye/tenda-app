/**
 * Onboarding-rail feature cards — the "you don't need gas money to start"
 * story.
 *
 * KEYED BY GAS POLICY, NOT BY CHAIN. The cards were never really about Solana,
 * Base and Celo; they are about the three ways gas gets out of a new user's
 * way, and the manifest already names those: `native-seed`, `feeCurrency`,
 * `paymaster`. Deriving the cards from `gasPolicy` means adding a chain that
 * reuses an existing policy costs ZERO copy edits — the new chain's name simply
 * joins the card that already describes its rail. Only a genuinely new policy
 * needs new prose, and then it needs exactly one template here.
 *
 * Status is honest: `live` ships today, `roadmap` does not exist yet and says
 * so. Nothing here may claim a rail the code cannot perform.
 */

import type { GasPolicy } from '@tenda/shared/chains'
import { prose } from '@/lib/prose'
import { ACTIVE_GAS_POLICIES, chainsByGasPolicy, type LandingChain } from './chains'

export type FeatureStatus = 'live' | 'roadmap'

export interface OnboardingFeature {
  id: string
  /** Lucide icon name, resolved by the section renderer. */
  icon: 'Fuel' | 'Sparkles' | 'Wallet' | 'Zap'
  /** Chains this rail covers. Empty for cross-chain cards. */
  chains: readonly LandingChain[]
  status: FeatureStatus
  title: string
  body: string
  /** Mono fact line under the body — a concrete, verifiable detail. */
  fact: string
}

/** What the renderer needs to fill one policy's template. */
interface PolicyContext {
  /** "Celo", or "Base and Celo" once a policy covers more than one chain. */
  names: string
  /** "SOL", or "SOL and ETH" — the native gas tokens of those chains. */
  natives: string
}

interface PolicyTemplate {
  id: string
  icon: OnboardingFeature['icon']
  status: FeatureStatus
  title: (c: PolicyContext) => string
  body: (c: PolicyContext) => string
  fact: (c: PolicyContext) => string
}

/**
 * One template per gas policy. `none` is deliberately absent: a chain where
 * the user simply pays their own gas has no onboarding story to tell, so it
 * contributes no card rather than an apologetic one.
 *
 * `paymaster` is `roadmap`, NOT in-progress. The server's ERC-4337 build path
 * sets the UserOperation sender to the user's EOA, which is invalid 4337 (an
 * EntryPoint calls validateUserOp on the sender, and an EOA has no code), and
 * the mobile dispatcher throws UnsupportedUnsignedTxError for that path. No
 * approach has been chosen yet, so the copy names no mechanism and promises
 * no date — see docs/paymaster_setup_and_findings.md.
 */
const GAS_POLICY_TEMPLATES: Partial<Record<GasPolicy, PolicyTemplate>> = {
  feeCurrency: {
    id: 'gas-in-stablecoin',
    icon: 'Fuel',
    status: 'live',
    title: () => 'Your USDC pays its own gas',
    body: (c) =>
      `On ${c.names}, network fees come out of the same USDC you trade with. No hunting for a separate gas token before your first move.`,
    fact: (c) => `feeCurrency: USDC — no ${c.natives} required`,
  },
  'native-seed': {
    id: 'gas-grant',
    icon: 'Sparkles',
    status: 'live',
    title: (c) => `Start with zero ${c.natives}`,
    body: (c) =>
      `Link your first ${c.names} wallet and Tenda seeds it with enough ${c.natives} for a full escrow lifecycle — post, lock, settle. One grant per person, on us.`,
    fact: () => 'one-time gas grant · covers your first escrow',
  },
  paymaster: {
    id: 'sponsored-gas',
    icon: 'Zap',
    status: 'roadmap',
    title: (c) => `Sponsored gas on ${c.names}`,
    body: (c) =>
      `Covering your first transactions on ${c.names} is on our roadmap. Until it ships you pay your own gas there — which on an L2 runs to a fraction of a cent.`,
    fact: () => 'on the roadmap · not available yet',
  },
}

/** The cross-chain card: not a gas policy, so it is declared rather than derived. */
const WALLET_FEATURE: Omit<OnboardingFeature, 'chains'> = {
  id: 'any-wallet',
  icon: 'Wallet',
  status: 'live',
  title: 'Bring the wallet you already have',
  body: 'On Solana, Android hands the connection to whichever wallet you use — Phantom, Solflare and the rest. On EVM chains, any WalletConnect wallet works.',
  fact: 'Mobile Wallet Adapter · WalletConnect',
}

function featureFor(policy: GasPolicy): OnboardingFeature | null {
  const template = GAS_POLICY_TEMPLATES[policy]
  if (template === undefined) return null

  const chains = chainsByGasPolicy(policy)
  if (chains.length === 0) return null

  const context: PolicyContext = {
    names: prose(chains.map((c) => c.name)),
    // A policy's chains can share a native token; dedupe so two Ethereum L2s
    // read as "ETH", never "ETH and ETH".
    natives: prose([...new Set(chains.map((c) => c.nativeSymbol))]),
  }

  return {
    id: template.id,
    icon: template.icon,
    chains,
    status: template.status,
    title: template.title(context),
    body: template.body(context),
    fact: template.fact(context),
  }
}

/**
 * Live rails first, roadmap last — a reader scanning the grid should meet what
 * works before what doesn't. Within each group, manifest order is preserved.
 */
export const ONBOARDING_FEATURES: readonly OnboardingFeature[] = (() => {
  const derived = ACTIVE_GAS_POLICIES.map(featureFor).filter(
    (f): f is OnboardingFeature => f !== null,
  )
  const live = derived.filter((f) => f.status === 'live')
  const roadmap = derived.filter((f) => f.status !== 'live')
  return [...live, { ...WALLET_FEATURE, chains: [] }, ...roadmap]
})()

export const ONBOARDING_HEADER = {
  eyebrow: 'Onboarding · less gas, less friction',
  h2: { lead: 'The hardest part of crypto,', emphasis: 'mostly removed.' },
  sub: 'Most people quit at "first, buy a gas token." Tenda deletes that step on the chains that can support it, and keeps it down to loose change everywhere else.',
} as const
