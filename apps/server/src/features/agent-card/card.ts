/**
 * The agent card itself — a pure function from "what we know" to the JSON
 * served at `/.well-known/agents/<address>.json`.
 *
 * WHAT THIS DOCUMENT IS FOR. An ERC-8004 Identity Registry mint takes a URI as
 * an argument and commits it on-chain; this is what that URI resolves to. A
 * reader who has only an agent's address — from a registry on any chain — uses
 * it to discover what the agent can do and where to reach it.
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

import { CHAIN_MANIFEST, PROOF_TYPES } from '@tenda/shared'

/** What the store found, or null when this address is not a Tenda agent. */
export interface AgentIdentity {
  user_id: string
  name: string
}

export interface AgentCard {
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
  /** Present only for a registered agent; a card for a bare address has none. */
  name?: string
  /**
   * CAIP-10 accounts, one per chain Tenda actually settles on.
   *
   * Derived from CHAIN_MANIFEST's own `status: 'live'` — a new chain is a
   * manifest entry and nothing here changes. It says "this address can transact
   * with Tenda on these chains", which is a fact about our deployment; it does
   * NOT claim the agent has ever transacted there, and must not be read that
   * way.
   */
  accounts: string[]
  endpoints: {
    /** The one-shot task endpoint (402 -> X-PAYMENT -> 201). */
    tasks: string
    /** The generated OpenAPI document, so a reader can discover the rest. */
    openapi: string
    /** LIVE reputation, by reference. Absent until the agent is registered. */
    reputation?: string
  }
  capabilities: {
    /** Proof kinds a worker may submit, from the shared vocabulary. */
    proof_types: readonly string[]
  }
}

/**
 * CAIP-10 for every EVM chain we settle on, for one address.
 *
 * EVM only: the address is an eip155 one, and a CAIP-10 naming it under
 * `solana:` would be a different key space and simply false.
 */
function liveEvmAccounts(address: string): string[] {
  return CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status === 'live').map(
    (c) => `${c.id}:${address}`,
  )
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
  return {
    schema: 'tenda-agent-card/v1',
    address,
    registered: identity !== null,
    ...(identity !== null ? { name: identity.name } : {}),
    accounts: liveEvmAccounts(address),
    endpoints: {
      tasks: `${base}/v1/agent/tasks`,
      openapi: `${base}/v1/openapi.json`,
      ...(identity !== null
        ? { reputation: `${base}/v1/users/${identity.user_id}/standing` }
        : {}),
    },
    capabilities: { proof_types: PROOF_TYPES },
  }
}
