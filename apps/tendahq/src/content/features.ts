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
import {
  ACTIVE_GAS_POLICIES,
  chainByFamily,
  chainsByGasPolicy,
  EVM_CHAIN_NAMES_PROSE,
  SOLANA_CHAIN_NAMES_PROSE,
  type LandingChain,
} from './chains'

export type FeatureStatus = 'live' | 'roadmap'

export interface OnboardingFeature {
  id: string
  /** Short selector label ("USDC gas") — the tab rail the section renders;
   *  titles are full sentences and would blow the rail's width. */
  tab: string
  /** Lucide icon name, resolved by the section renderer. */
  icon: 'Bot' | 'Fuel' | 'Sparkles' | 'Wallet' | 'Zap'
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
  tab: string
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
    tab: 'USDC gas',
    icon: 'Fuel',
    status: 'live',
    title: () => 'Your USDC pays its own gas',
    body: (c) =>
      `On ${c.names}, network fees come out of the same USDC you trade with. No hunting for a separate gas token before your first move.`,
    fact: (c) => `feeCurrency: USDC — no ${c.natives} required`,
  },
  'native-seed': {
    id: 'gas-grant',
    tab: 'Gas grant',
    icon: 'Sparkles',
    status: 'live',
    title: (c) => `Start with zero ${c.natives}`,
    body: (c) =>
      `Link your first ${c.names} wallet and Tenda seeds it with enough ${c.natives} for a full escrow lifecycle — post, lock, settle. One grant per person, on us.`,
    fact: () => 'one-time gas grant · covers your first escrow',
  },
  paymaster: {
    id: 'sponsored-gas',
    tab: 'Sponsored gas',
    icon: 'Zap',
    status: 'roadmap',
    title: (c) => `Sponsored gas on ${c.names}`,
    body: (c) =>
      `Covering your first transactions on ${c.names} is on our roadmap. Until it ships you pay your own gas there — which on an L2 runs to a fraction of a cent.`,
    fact: () => 'on the roadmap · not available yet',
  },
}

/**
 * The chain-derived strings a policy's copy needs. Shared by the cards and by
 * GAS_FREE_START_SENTENCE, which describe the same rails in different grammar
 * and must never disagree about which chains are on them.
 */
function contextFor(chains: readonly LandingChain[]): PolicyContext {
  return {
    names: prose(chains.map((c) => c.name)),
    // A policy's chains can share a native token; dedupe so two Ethereum L2s
    // read as "ETH", never "ETH and ETH".
    natives: prose([...new Set(chains.map((c) => c.nativeSymbol))]),
  }
}

/**
 * The cross-chain card. Not a gas policy, so it is not derived from one — but
 * the chains it names still are: the wallet story splits on CAIP-2 namespace
 * (Solana goes through Mobile Wallet Adapter, every eip155 chain through
 * WalletConnect), so a new EVM L2 joins the second half of this sentence by
 * itself. This card was the one that still typed "On Solana … On EVM chains"
 * by hand while the other three derived their chain names.
 */
const WALLET_FEATURE: Omit<OnboardingFeature, 'chains'> = {
  id: 'any-wallet',
  tab: 'Any wallet',
  icon: 'Wallet',
  status: 'live',
  title: 'Bring the wallet you already have',
  body: `On ${SOLANA_CHAIN_NAMES_PROSE}, Android hands the connection to whichever wallet you use — Phantom, Solflare and the rest. On ${EVM_CHAIN_NAMES_PROSE}, any WalletConnect wallet works.`,
  fact: 'Mobile Wallet Adapter · WalletConnect',
}

/**
 * "new Solana wallets get seeded with a small SOL grant, and on Celo your USDC
 * pays its own fees" — the gas-free-start sentence, assembled from the same
 * policy templates the cards use so the FAQ cannot name a chain the manifest
 * has stopped shipping (or miss one it has started).
 *
 * Only LIVE policies contribute: a roadmap rail has no business appearing in a
 * sentence that promises you can start without gas money.
 */
const GAS_FREE_CLAUSES: Partial<Record<GasPolicy, (c: PolicyContext) => string>> = {
  'native-seed': (c) => `new ${c.names} wallets get seeded with a small ${c.natives} grant`,
  feeCurrency: (c) => `on ${c.names} your USDC pays its own fees`,
}

/**
 * Build the sentence for a given set of policies. Exported so the SKIP paths
 * can be exercised: a policy with no clause (`none`), and a policy whose rail
 * is only on the roadmap (`paymaster`). Both must drop out — a sentence that
 * promises you can start without gas money has no business naming a chain
 * where you cannot.
 *
 * The third skip, `chains.length === 0`, is deliberately UNCOVERED and stays
 * that way. It fires when a policy still has copy but has lost its last chain
 * — the state you pass through by REMOVING a manifest entry, not by adding
 * one. Reaching it from a test would mean stubbing CHAIN_MANIFEST, which tests
 * the stub; leaving the guard out would render "On , network fees come out
 * of…" the first time a chain is retired. So: a guard worth having, a branch
 * not worth faking. `featureFor` carries the same pair for the same reason.
 */
export function gasFreeSentence(policies: readonly GasPolicy[]): string {
  return `${prose(
    policies.flatMap((policy) => {
      const clause = GAS_FREE_CLAUSES[policy]
      const chains = chainsByGasPolicy(policy)
      if (clause === undefined || chains.length === 0) return []
      if (GAS_POLICY_TEMPLATES[policy]?.status !== 'live') return []
      return [clause(contextFor(chains))]
    }),
  )}.`
}

export const GAS_FREE_START_SENTENCE = gasFreeSentence(ACTIVE_GAS_POLICIES)

/**
 * One card for one gas policy, or null when the policy has no copy (`none`,
 * deliberately) or no chain currently running it. Exported for the same reason
 * as gasFreeSentence: both null paths are unreachable through the live
 * manifest and both decide whether a card appears at all.
 */
export function featureFor(policy: GasPolicy): OnboardingFeature | null {
  const template = GAS_POLICY_TEMPLATES[policy]
  if (template === undefined) return null

  const chains = chainsByGasPolicy(policy)
  if (chains.length === 0) return null

  const context = contextFor(chains)

  return {
    id: template.id,
    tab: template.tab,
    icon: template.icon,
    chains,
    status: template.status,
    title: template.title(context),
    body: template.body(context),
    fact: template.fact(context),
  }
}

/**
 * The 0G agent rail — Onboarding's 0G card. Not a gas policy (0G's manifest
 * policy is 'none', which deliberately contributes no card), so like
 * WALLET_FEATURE it is hand-written; unlike it, it names its chain. `roadmap`,
 * not in-progress: the sign-only funding design (x402 — the agent signs a
 * payment authorization, Tenda relays it on-chain) is decided but not shipped,
 * so the copy names the mechanism only as far as it is true and promises no
 * date. The person reading this card is the second audience Onboarding now
 * has: someone pointing an AI agent at Tenda rather than a phone.
 */
const AGENT_FEATURE: Omit<OnboardingFeature, 'chains'> = {
  id: 'agent-signature-funding',
  tab: 'Agent pay',
  icon: 'Bot',
  status: 'roadmap',
  title: 'AI agents pay with a signature',
  body: 'On 0G, an AI agent will fund escrow by signing a payment authorization — Tenda relays it on-chain. No gas token to hold, no bridge, no custody.',
  fact: 'sign-only funding · on the roadmap',
}

/**
 * Live rails first, roadmap last — a reader scanning the grid should meet what
 * works before what doesn't. Within each group, manifest order is preserved;
 * the agent card leads the roadmap group (0G-first positioning, 2026-08-27).
 */
export const ONBOARDING_FEATURES: readonly OnboardingFeature[] = (() => {
  const derived = ACTIVE_GAS_POLICIES.map(featureFor).filter(
    (f): f is OnboardingFeature => f !== null,
  )
  const live = derived.filter((f) => f.status === 'live')
  const roadmap = derived.filter((f) => f.status !== 'live')
  // The `[]` arm is the removal path — it fires only if 0G leaves the
  // manifest, the same deliberately-unfaked class as featureFor's
  // zero-chains guard above: reaching it from a test would mean stubbing
  // CHAIN_MANIFEST, which tests the stub. The card then ships chainless
  // (like WALLET_FEATURE) rather than crashing the section.
  const zeroG = chainByFamily('0g')
  return [
    ...live,
    { ...WALLET_FEATURE, chains: [] },
    { ...AGENT_FEATURE, chains: zeroG === undefined ? [] : [zeroG] },
    ...roadmap,
  ]
})()

export const ONBOARDING_HEADER = {
  eyebrow: 'Onboarding · less gas, less friction',
  h2: { lead: 'The hardest part of crypto,', emphasis: 'mostly removed.' },
  sub: 'Most people quit at "first, buy a gas token." Tenda deletes that step on the chains that can support it, and keeps it down to loose change everywhere else.',
} as const
