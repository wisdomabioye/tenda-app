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
import { chainStatus } from './chain-status'
import { AGENT_BADGE_LABEL } from '@tenda/shared/constants/users'

/**
 * What a card may claim.
 *
 * - 'live'    the rail is built AND runs on a chain a visitor can use today
 * - 'testnet' the rail is built and working, but only where Tenda is deployed —
 *             which today is testnet only
 * - 'roadmap' the rail does not exist yet
 *
 * 'testnet' exists because two independent facts were previously collapsed into
 * one hardcoded string. The USDC-gas and gas-grant cards were declared 'live'
 * beside chain names taken from LANDING_CHAINS (mainnet), so the section
 * announced, with a pulsing Live pill, two conveniences on chains that have no
 * contract. Calling them 'roadmap' would have been the opposite error: both
 * rails are built and verified on-chain. Only 'testnet' is true of both halves.
 */
export type FeatureStatus = 'live' | 'testnet' | 'roadmap'

/**
 * Whether the RAIL ITSELF exists, independent of where it is deployed.
 *
 * Kept separate from FeatureStatus because the two answer different questions
 * and one of them does not move with deployment at all: `paymaster` is unbuilt
 * because the ERC-4337 path sets the UserOperation sender to the user's EOA,
 * which is invalid 4337 — that stays true no matter which chains go live. A
 * single hardcoded status could not express "built but unreachable" and
 * "unbuilt" as different things, so it expressed neither.
 */
type RailBuild = 'built' | 'unbuilt'

export interface OnboardingFeature {
  id: string
  /** Short selector label ("USDC gas") — the tab rail the section renders;
   *  titles are full sentences and would blow the rail's width. */
  tab: string
  /** Lucide icon name, resolved by the section renderer. */
  icon: 'Bot' | 'Fuel' | 'Handshake' | 'Sparkles' | 'Wallet' | 'Zap'
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
  /** Whether the rail exists. The CARD's status is derived — see statusFor. */
  rail: RailBuild
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
    rail: 'built',
    title: () => 'Your USDC pays its own gas',
    body: (c) =>
      `On ${c.names}, network fees come out of the same USDC you trade with. No hunting for a separate gas token before your first move.`,
    fact: (c) => `feeCurrency: USDC — no ${c.natives} required`,
  },
  /*
   * `unbuilt`, DELIBERATELY, even though the rail is fully wired on Solana.
   *
   * The card covers every chain whose gasPolicy is 'native-seed', and since 0G
   * joined that set the card spans both namespaces — but the seed only exists
   * for one. TWO places hardcode it: `buildGasSeedDeps` builds a Solana sender
   * or none at all, and `db/seed/rows.ts` resolves a funder wallet only when
   * `namespace === 'solana'`, so an EVM chain seeds NULL and dispatch skips it
   * in silence. A card claiming a grant on 0G would therefore be false, and a
   * first-time user would meet that falsehood on their very first transaction.
   *
   * One card carries one status, so the choice is which way to be wrong.
   * Understating a shipped Solana rail is visible to us and costs a user
   * nothing; overstating an absent EVM one costs them a failed transaction.
   * Decision taken 2026-08-31; flip to 'built' when #53 lands the EVM sender,
   * and the copy below comes back with it.
   */
  'native-seed': {
    id: 'gas-grant',
    tab: 'Gas grant',
    icon: 'Sparkles',
    rail: 'unbuilt',
    title: (c) => `Start with zero ${c.natives}`,
    body: (c) =>
      `Linking your first ${c.names} wallet will seed it with enough ${c.natives} for a full escrow lifecycle — post, lock, settle. It runs on Solana today and is not yet available everywhere, so until it is you pay your own gas.`,
    fact: () => 'one-time gas grant · not available on every chain yet',
  },
  paymaster: {
    id: 'sponsored-gas',
    tab: 'Sponsored gas',
    icon: 'Zap',
    rail: 'unbuilt',
    title: (c) => `Sponsored gas on ${c.names}`,
    body: (c) =>
      `Covering your first transactions on ${c.names} is on our roadmap. Until it ships you pay your own gas there — which on an L2 runs to a fraction of a cent.`,
    fact: () => 'on the roadmap · not available yet',
  },
}

/**
 * How a card's status is presented.
 *
 * Keyed by FeatureStatus so a new value is a type error here rather than a card
 * that renders no pill. Tones are literal strings resolved by the renderer,
 * matching how this module already names its icons — content stays free of
 * component imports. The mirror of CHAIN_STATUS_DISPLAY in chain-status.ts, and
 * deliberately the same shape: the two sections make the same kind of claim.
 */
export const FEATURE_STATUS_DISPLAY: Record<
  FeatureStatus,
  { label: string; tone: 'live' | 'brand' | 'neutral' }
> = {
  live: { label: 'Live', tone: 'live' },
  testnet: { label: 'Testnet', tone: 'brand' },
  roadmap: { label: 'Roadmap', tone: 'neutral' },
}

/**
 * A card's status: the rail being built AND being reachable on a chain the
 * visitor can use.
 *
 * Both halves are load-bearing and neither can stand in for the other. The
 * USDC-gas and gas-grant rails are built and verified on-chain, so 'roadmap'
 * would be false about them; they run only on Celo and Solana MAINNET, which
 * have no contract, so 'live' was false too. `paymaster` fails the first half
 * for a reason that has nothing to do with chains and must survive Base going
 * live, which is exactly why the rail flag is declared rather than derived.
 *
 * Exported for the reason gasFreeSentence and featureFor are: the 'live' arm
 * cannot be reached through the current manifest — no mainnet chain is
 * deployed — and it is the arm that fires the day one is. A branch that first
 * runs on launch day is the last one that should be left untested.
 */
export function statusFor(rail: RailBuild, chains: readonly LandingChain[]): FeatureStatus {
  if (rail === 'unbuilt') return 'roadmap'
  return chains.some((chain) => chainStatus(chain) === 'live') ? 'live' : 'testnet'
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
  /*
   * 'live', and NOT subject to statusFor — deliberately, because this card's
   * claim does not depend on escrow deployment at all.
   *
   * The gas cards do: a gas grant needs Tenda's per-chain seeding wallet, and
   * paying fees in USDC happens inside a Tenda transaction, so neither is
   * reachable until the contract is. Wallet CONNECTION is a property of the
   * app and the transport — Mobile Wallet Adapter on Android, WalletConnect on
   * any EVM chain. It works today and it goes on working unchanged at mainnet,
   * so gating it on chain status would mark a shipped capability as pending and
   * then "promote" it on launch day, having changed nothing.
   *
   * The rule this file follows is not "everything defers to chain status" — it
   * is "a claim defers to whatever it actually depends on".
   */
  status: 'live',
  title: 'Bring the wallet you already have',
  body: `On ${SOLANA_CHAIN_NAMES_PROSE}, Android hands the connection to whichever wallet you use — Phantom, Solflare and the rest. On ${EVM_CHAIN_NAMES_PROSE}, any WalletConnect wallet works.`,
  fact: 'Mobile Wallet Adapter · WalletConnect',
}

/**
 * "new Solana wallets get seeded with a small SOL grant, and on Celo your USDC
 * pays its own fees" — the gas-free-start clauses, assembled from the same
 * policy templates the cards use so the FAQ cannot name a chain the manifest
 * has stopped shipping (or miss one it has started).
 *
 * Only rails that EXIST contribute. A roadmap rail has no business in a
 * sentence promising you can start without gas money; a 'testnet' rail does,
 * because it genuinely works on the networks this release talks to.
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
  const clauses = policies.flatMap((policy) => {
    const clause = GAS_FREE_CLAUSES[policy]
    const chains = chainsByGasPolicy(policy)
    if (clause === undefined || chains.length === 0) return []
    const template = GAS_POLICY_TEMPLATES[policy]
    if (template === undefined || statusFor(template.rail, chains) === 'roadmap') return []
    return [clause(contextFor(chains))]
  })
  // EMPTY MEANS EMPTY, not ".". This used to append the full stop
  // unconditionally, so a run with no qualifying rail produced a lone "." —
  // which the FAQ rendered as "you don't even need gas money to start: ." The
  // whole promise now carries inside the string, so having nothing to say
  // removes the sentence instead of leaving its punctuation behind.
  if (clauses.length === 0) return ''
  return `You don't even need gas money to start: ${prose(clauses)}.`
}

/**
 * The gas-free promise as a WHOLE sentence, lead-in included, or '' when no
 * rail can back it. Callers render it as its own sentence — see the note above
 * on why the lead-in moved in here.
 */
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
    status: statusFor(template.rail, chains),
    title: template.title(context),
    body: template.body(context),
    fact: template.fact(context),
  }
}

/**
 * The 0G agent rail — Onboarding's 0G card. Not a gas policy (0G's manifest
 * policy is 'none', which deliberately contributes no card), so like
 * WALLET_FEATURE it is hand-written; unlike it, it NAMES A CHAIN, which is why
 * its status derives rather than being declared.
 *
 * IT SHIPPED. This card read `roadmap` with the copy "an agent WILL fund
 * escrow" and a fact line of "on the roadmap" — written while the x402
 * sign-only design was decided but unbuilt, and left behind when it was built.
 * The fund route, the agent API and a full agent-to-human hire settling in four
 * on-chain transactions all landed and were verified end to end on 0G Galileo.
 * A stale roadmap label understates shipped work exactly as a premature live
 * one overstates unshipped work; both are the same failure to keep a status
 * tied to something real.
 *
 * It reads Testnet rather than Live because the rail relays an on-chain
 * transfer into the escrow contract, so it genuinely depends on that contract
 * being deployed — and it names 0G MAINNET, which is launching, not live. It
 * becomes Live on its own the day #13 deploys, with no edit here. That chain
 * dependency is what separates it from WALLET_FEATURE, whose transports do not
 * touch the escrow at all.
 */
const AGENT_FEATURE: Omit<OnboardingFeature, 'chains' | 'status'> = {
  id: 'agent-signature-funding',
  tab: 'Agent pay',
  icon: 'Bot',
  title: 'AI agents pay with a signature',
  body: 'On 0G, an AI agent funds escrow by signing a payment authorization — Tenda relays it on-chain. No gas token to hold, no bridge, no custody.',
  fact: 'sign-only funding · x402 · verified end to end',
}

/**
 * The other side of the agent rail — Onboarding's second 0G card.
 *
 * AGENT_FEATURE is written for someone POINTING AN AGENT at Tenda. This one is
 * written for the person on the other end of that hire, who is the section's
 * primary reader and had nothing addressed to them: 0G declares
 * `gasPolicy: 'none'`, so it contributes no gas card, and the launch chain was
 * absent from the getting-started section entirely.
 *
 * Every clause is a shipped fact, not positioning. An agent posts and funds
 * through the same escrow primitive a person uses (#19 composes
 * draftResolution / attachGigDetails / relayDraftFunding); the badge is real and
 * on every surface that names a counterparty (PersonCard, GigCard, the gig
 * poster card, the profile page, with its own e2e spec); and the lifecycle that
 * follows is the ordinary one, settled end to end in #20.
 *
 * TYPOGRAPHIC quotes, not straight ones. React escapes `"` to `&quot;` in text,
 * so a body containing straight quotes does not survive into the markup as
 * written — and the onboarding render test compares the raw string against the
 * rendered HTML. It passed only while this card was not the default rail; the
 * moment it led the section the mismatch surfaced. Curly quotes pass through
 * untouched, and match the sibling notes.
 *
 * The badge text is READ FROM the shared constant rather than typed. If the app
 * ever relabels agents, copy promising a specific label would quietly become a
 * promise the product no longer keeps.
 */
const AGENT_HIRE_FEATURE: Omit<OnboardingFeature, 'chains' | 'status'> = {
  id: 'agent-hires-you',
  tab: 'Agent hires',
  icon: 'Handshake',
  title: 'Your next client might be an AI',
  body: `On 0G, an AI agent posts a gig and funds escrow exactly as a person does — and it carries an “${AGENT_BADGE_LABEL}” badge everywhere it appears. You accept, do the work, submit proof, and the contract pays out.`,
  fact: 'same escrow as any gig · labelled, never hidden',
}

/**
 * Rails that EXIST first, roadmap last — a reader scanning the grid should meet
 * what works before what doesn't. 'live' and 'testnet' group together for that
 * ordering because both describe something built; only 'roadmap' describes
 * something absent. Within each group, manifest order is preserved; the agent
 * card leads the roadmap group (0G-first positioning, 2026-08-27).
 */
export const ONBOARDING_FEATURES: readonly OnboardingFeature[] = (() => {
  const derived = ACTIVE_GAS_POLICIES.map(featureFor).filter(
    (f): f is OnboardingFeature => f !== null,
  )
  // Split on EXISTS, not on 'live'. Splitting on 'live' was right when there
  // were two statuses; with three it put every built-but-unreachable rail into
  // the roadmap group, so the section led with a roadmap card and interleaved
  // Testnet and Roadmap pills down the rail. A reader scanning it could no
  // longer tell built from unbuilt by position.
  const built = derived.filter((f) => f.status !== 'roadmap')
  const roadmap = derived.filter((f) => f.status === 'roadmap')
  // The `[]` arm is the removal path — it fires only if 0G leaves the
  // manifest, the same deliberately-unfaked class as featureFor's
  // zero-chains guard above: reaching it from a test would mean stubbing
  // CHAIN_MANIFEST, which tests the stub. The card then ships chainless
  // (like WALLET_FEATURE) rather than crashing the section.
  const zeroG = chainByFamily('0g')
  const agentChains = zeroG === undefined ? [] : [zeroG]
  const agentCard = { ...AGENT_FEATURE, status: statusFor('built', agentChains) }
  return [
    // Beside the agent card: same chain, opposite audience. Its status derives
    // the same way, so both 0G cards move together when the chain deploys.
    { ...AGENT_HIRE_FEATURE, status: statusFor('built', agentChains), chains: agentChains },
    // Status derived from the chain it names, not declared: the rail is built
    // (#18/#19/#20), so what is left to decide is reachability, and that is
    // statusFor's job. A chainless 0G — the removal path below — leaves the
    // rail built with nothing to place it on, which reads Testnet.
    { ...agentCard, chains: agentChains },
    ...built,
    { ...WALLET_FEATURE, chains: [] },
    ...roadmap,
  ]
})()

export const ONBOARDING_HEADER = {
  eyebrow: 'Onboarding · less gas, less friction',
  h2: { lead: 'The hardest part of crypto,', emphasis: 'mostly removed.' },
  sub: 'Most people quit at "first, buy a gas token." Tenda deletes that step on the chains that can support it, and keeps it down to loose change everywhere else.',
} as const
