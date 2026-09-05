/**
 * The agent card itself — a pure function from "what we know" to the JSON
 * served at `/.well-known/agents/<address>.json`.
 *
 * WHAT THIS DOCUMENT IS FOR. An ERC-8004 Identity Registry mint takes a URI as
 * an argument and commits it on-chain; this is what that URI resolves to. A
 * reader who has only an agent's address — from a registry on any chain — uses
 * it to discover what the agent can do and where to reach it.
 *
 * IT IS AN ERC-8004 REGISTRATION FILE FIRST, a Tenda document second (#105).
 * The first cut of this card (#84) was a Tenda-invented shape that satisfied
 * none of the standard's required fields, which meant the exact document a
 * fresh mint would point at could not validate. `type`, `name`, `description`
 * and `image` now always appear, and the endpoint list is an ARRAY of typed
 * entries rather than an object keyed by name — in both spellings the two
 * sources use, for the reason set out next.
 *
 * TWO SOURCES THAT DISAGREE, so this satisfies BOTH — verified 2026-09-05.
 *
 *   EIP-8004   `services:  [{ name, endpoint }]`, and it is REQUIRED.
 *              `image` required, for ERC-721 app compatibility.
 *   Celo docs  `endpoints: [{ type, url }]` plus `{ type: 'wallet', address,
 *              chainId }`. `image` optional.
 *
 * Those are different SHAPES, not one field under two names, so the card emits
 * both — built from one internal list below, which is what stops them drifting.
 * A reader that knows only the EIP finds `services`; Celo's own tooling, which
 * this mints against, finds `endpoints` with the wallet entries the EIP shape
 * has nowhere to put. `image` is always emitted: including an optional field
 * costs one line, omitting a required one fails validation.
 *
 * OUR OWN FIELDS sit alongside (`schema`, `address`, `registered`,
 * `capabilities`). The EIP does not explicitly permit extra top-level fields —
 * it is silent, not permissive, and this comment previously overstated that.
 * They are kept because they are additive rather than contradictory, and
 * because Celo's own documented example already carries a wallet entry the EIP
 * shape does not define. If a validator ever rejects unknown keys, these are
 * the four to drop, and dropping them costs no required field.
 *
 * STABLE FACTS ONLY, and that is a constraint rather than a style. The URI is
 * committed on-chain, so anything that changes per interaction cannot live
 * here: the card links to reputation, it never states a score. Putting a score
 * in would mean a chain write per review (#82 exists for that question).
 *
 * KEYED BY ADDRESS, NEVER BY tokenId. TokenIds are per-registry and per-chain —
 * token #7 on Celo and token #7 on Base are unrelated agents — so a tokenId key
 * produces a different URL per chain and three cards that drift. The address is
 * the same on every EVM chain, exists before any registration, and is already
 * how Tenda identifies an agent (wallet-born accounts, #19).
 */

import { APP_INFO, CHAIN_MANIFEST, PROOF_TYPES, evmChainNumericId } from '@tenda/shared'
import type { ProofType } from '@tenda/shared'

/** What the store found, or null when this address is not a Tenda agent. */
export interface AgentIdentity {
  user_id: string
  name: string
  /** `users.bio` — the agent's own description, when it has written one. */
  description: string | null
  /** `users.avatar_url` — the agent's own image, when it has uploaded one. */
  image: string | null
}

/**
 * A wallet this agent controls, one entry per chain Tenda settles on.
 *
 * `chainId` is a NUMBER, per Celo's documented example, and is derived from
 * the manifest's CAIP-2 id rather than written down a second time.
 */
export interface WalletEndpoint {
  type: 'wallet'
  address: string
  chainId: number
}

/** The service endpoints a reader can actually call. */
export type AgentServiceType = 'tasks' | 'openapi' | 'reputation'

/** Celo's documented shape. */
export interface ServiceEndpoint {
  type: AgentServiceType
  url: string
}

/** EIP-8004's own shape for the same fact — `services`, not `endpoints`. */
export interface EipService {
  name: AgentServiceType
  endpoint: string
}

export type AgentCardEndpoint = WalletEndpoint | ServiceEndpoint

export interface AgentCard {
  // --- ERC-8004 required ---------------------------------------------------
  /** Fixed by the standard. An ERC-721 app keys on this. */
  type: 'Agent'
  /** Never empty: an unregistered address is named after itself. */
  name: string
  description: string
  image: string

  // --- ERC-8004 required, in the EIP's own spelling -------------------------
  /**
   * The EIP names this array `services` with `{ name, endpoint }` entries, and
   * requires it. Derived from the same list as `endpoints` below, never written
   * twice. Wallets are absent here on purpose: the EIP's service shape has no
   * field for an address or a chain id, and inventing one would be a claim the
   * standard does not define.
   */
  services: EipService[]

  // --- ERC-8004 optional, and true of us -----------------------------------
  /** Celo's spelling of the same endpoints, plus the wallet entries. */
  endpoints: AgentCardEndpoint[]
  /**
   * Only `reputation`, and the omissions are the honest part: we expose
   * standing by reference and run no validation service and no TEE. Claiming
   * either in a document committed on-chain would be a claim we cannot meet.
   */
  supportedTrust: readonly ['reputation']
  /** The task endpoint is 402-gated (#19), which is exactly what this field asks. */
  x402Support: true

  // --- Tenda's own; see the header for why these are kept -------------------
  schema: 'tenda-agent-card/v1'
  /** Canonical lowercase 0x address — the key this document is served under. */
  address: string
  /**
   * Whether this address is a registered Tenda agent.
   *
   * FALSE IS A VALID, SERVABLE CARD, not an error. The URI is committed at MINT
   * time, which can precede any Tenda-side registration — so a 404 here would
   * mean the on-chain pointer is broken during exactly the window the agent is
   * being created in. A minimal card resolves, and gains its identity fields
   * when the agent registers, with no second transaction.
   */
  registered: boolean
  capabilities: {
    /** Proof kinds a worker may submit, from the shared vocabulary. */
    proof_types: readonly ProofType[]
  }
}

/**
 * `0x1234…cdef` — for the fallback name only.
 *
 * Local rather than shared: `packages/shared/src/wallet/wallet-address.ts`
 * picks WHICH address to show, never how to abbreviate one, and one caller does
 * not earn a shared helper. It stays inside the removable feature directory.
 */
function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * One wallet endpoint per EVM chain we settle on, for one address.
 *
 * Derived from CHAIN_MANIFEST's own `status: 'live'` — a new chain is a
 * manifest entry and nothing here changes. It says "this address can transact
 * with Tenda on these chains", which is a fact about our deployment; it does
 * NOT claim the agent has ever transacted there, and must not be read that way.
 *
 * EVM only: the address is an eip155 one, and naming it under `solana:` would
 * be a different key space and simply false.
 */
function liveEvmWallets(address: string): WalletEndpoint[] {
  return CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status === 'live').map((c) => ({
    type: 'wallet',
    address,
    // `evmChainNumericId` is the shared parser and it THROWS on a malformed id
    // rather than yielding NaN. No branch is needed here and none is wanted:
    // `assertManifestValid` refuses an eip155 entry whose id would not parse, so
    // for a manifest entry this call is total. A local null-check would be an
    // unreachable branch pretending the guarantee is weaker than it is.
    chainId: evmChainNumericId(c.id),
  }))
}

/**
 * Build the card. Pure — no I/O, no clock, no env read beyond the base URL the
 * caller passes, so the whole document is a function of its inputs and the
 * manifest.
 */
export function buildAgentCard(args: {
  address: string
  api_base_url: string
  identity: AgentIdentity | null
}): AgentCard {
  const { address, api_base_url: base, identity } = args

  const services: ServiceEndpoint[] = [
    { type: 'tasks', url: `${base}/v1/agent/tasks` },
    { type: 'openapi', url: `${base}/v1/openapi.json` },
  ]
  if (identity !== null) {
    services.push({ type: 'reputation', url: `${base}/v1/users/${identity.user_id}/standing` })
  }

  return {
    type: 'Agent',
    // `||`, not `??`, throughout: an agent whose name, bio or avatar is stored
    // as the empty string must fall back, not publish a blank required field.
    // `formatFullName` returns '' for an agent with no name at all.
    name: identity?.name || `${APP_INFO.name} agent ${shortAddress(address)}`,
    description: identity?.description || APP_INFO.description,
    image: identity?.image || APP_INFO.external.logo,
    services: services.map((s) => ({ name: s.type, endpoint: s.url })),
    endpoints: [...services, ...liveEvmWallets(address)],
    supportedTrust: ['reputation'],
    x402Support: true,
    schema: 'tenda-agent-card/v1',
    address,
    registered: identity !== null,
    capabilities: { proof_types: PROOF_TYPES },
  }
}
