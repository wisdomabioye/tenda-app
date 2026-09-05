/**
 * The agent card document (#84, reshaped to the standard in #105) —
 * `buildAgentCard` is pure, so this suite needs no app, no database, no clock.
 *
 * WHAT IS ACTUALLY BEING GUARDED. The card's URI is committed ON-CHAIN by an
 * ERC-8004 mint, so its shape is a promise that cannot be withdrawn cheaply.
 * Three properties matter more than the field list: it must SATISFY THE
 * STANDARD in every state including the unregistered one, it must never carry a
 * reputation SCORE (that would mean a chain write per review), and every
 * derived field must come from a shared source rather than a literal, so a new
 * chain or a new proof type reaches the card without anyone editing it.
 *
 * THE #105 LESSON, and the reason the first block below exists: #84's suite
 * asserted the card against our OWN design and passed completely while the
 * document satisfied none of the standard's required fields. Tests that only
 * describe the thing they are testing cannot discover it is the wrong thing.
 * These assert the external contract first.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { APP_INFO, CHAIN_MANIFEST, PROOF_TYPES } from '@tenda/shared'
import { buildAgentCard } from '@server/features/agent-card'
import type { AgentCard, AgentIdentity, ServiceEndpoint, WalletEndpoint } from '@server/features/agent-card'

const ADDRESS = '0x00000000000000000000000000000000000000a1'
const BASE = 'https://api.example.test'
const IDENTITY: AgentIdentity = {
  user_id: 'a1b2c3d4-0000-4000-8000-000000000001',
  name: 'Scout',
  description: 'Verifies business listings.',
  image: 'https://cdn.example.test/scout.png',
}

const card = (identity: AgentIdentity | null = null) =>
  buildAgentCard({ address: ADDRESS, api_base_url: BASE, identity })

const wallets = (c: AgentCard): WalletEndpoint[] =>
  c.endpoints.filter((e): e is WalletEndpoint => e.type === 'wallet')
const services = (c: AgentCard): ServiceEndpoint[] =>
  c.endpoints.filter((e): e is ServiceEndpoint => e.type !== 'wallet')

/** The STRING fields ERC-8004 requires of a registration file. `services` is
 *  required too, but it is an array and is asserted separately below. */
const REQUIRED_FIELDS = ['type', 'name', 'description', 'image'] as const

// --- the external contract: does this satisfy ERC-8004 at all? -------------

for (const [label, identity] of [
  ['unregistered', null],
  ['registered', IDENTITY],
] as const) {
  test(`a ${label} card carries every field the standard requires, non-empty`, () => {
    // The unregistered case is the one that matters most and the one #84 got
    // wrong: an ERC-8004 URI is committed at MINT time, so the document a fresh
    // mint points at is precisely the one with no Tenda agent behind it. If
    // that document cannot validate, the standard-conformance is decorative.
    const c = card(identity)
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in c, `required field ${field} is missing`)
      assert.strictEqual(typeof c[field], 'string', `${field} must be a string`)
      assert.notStrictEqual(c[field], '', `${field} must not be empty`)
    }
    assert.strictEqual(c.type, 'Agent', 'the standard fixes `type` to "Agent"')
  })
}

test('endpoints is an ARRAY of typed entries, not an object keyed by name', () => {
  // #84 emitted `{ tasks, openapi }`. A reader looping the array the standard
  // specifies gets nothing at all from an object, which is a silent failure —
  // the document parses, and every endpoint is invisible.
  const c = card(IDENTITY)
  assert.ok(Array.isArray(c.endpoints), 'endpoints must be an array')
  assert.ok(c.endpoints.length > 0)
  for (const entry of c.endpoints) {
    assert.strictEqual(typeof entry.type, 'string')
    assert.notStrictEqual(entry.type, '')
  }
})

test('the EIP-shaped `services` array is present and REQUIRED-field complete', () => {
  // EIP-8004 names this `services` with `{ name, endpoint }` entries and marks
  // it required; Celo's docs name it `endpoints` with `{ type, url }`. Those are
  // different shapes, so a card that emits only one satisfies only one reader —
  // and the URI is committed on-chain, where we do not get to choose the reader.
  const c = card(IDENTITY)
  assert.ok(Array.isArray(c.services), 'services must be present, the EIP requires it')
  assert.ok(c.services.length > 0)
  for (const s of c.services) {
    assert.strictEqual(typeof s.name, 'string')
    assert.notStrictEqual(s.name, '')
    assert.ok(s.endpoint.startsWith(BASE), `${s.endpoint} is not under the base URL`)
    assert.ok(!('type' in s), 'the EIP shape uses `name`, not `type`')
    assert.ok(!('url' in s), 'the EIP shape uses `endpoint`, not `url`')
  }
})

test('`services` and `endpoints` describe the SAME endpoints — one source, no drift', () => {
  // They are emitted from one internal list. If they are ever built separately,
  // one will gain an endpoint the other lacks and the document will say two
  // different things about the same agent.
  const c = card(IDENTITY)
  assert.deepStrictEqual(
    c.services.map((s) => [s.name, s.endpoint]),
    services(c).map((s) => [s.type, s.url]),
  )
})

test('`services` carries no wallet entries — the EIP shape has nowhere to put one', () => {
  // A wallet needs an address and a chain id; `{ name, endpoint }` has neither,
  // so forcing one in would invent a field the standard does not define. The
  // wallets live in Celo's `endpoints` array, which does define them.
  const c = card()
  assert.ok(!c.services.some((s) => (s.name as string) === 'wallet'))
  assert.ok(wallets(c).length > 0, 'the wallets must still be advertised somewhere')
})

test('a wallet entry carries a NUMERIC chainId, as the standard shows it', () => {
  // A string "84532" would be the easy mistake and the standard's example is
  // unambiguous that this is a number.
  for (const w of wallets(card())) {
    assert.strictEqual(typeof w.chainId, 'number', 'chainId must be a number')
    assert.ok(Number.isInteger(w.chainId) && w.chainId > 0, `${w.chainId} is not a chain id`)
    assert.strictEqual(w.address, ADDRESS)
  }
})

test('supportedTrust claims only what we actually run', () => {
  // Honest omission: we expose standing by reference and operate no validation
  // service and no TEE. This document is committed on-chain — a claim here is
  // not cheap to retract.
  assert.deepStrictEqual(card(IDENTITY).supportedTrust, ['reputation'])
})

test('x402Support is declared, because the task endpoint really is 402-gated', () => {
  assert.strictEqual(card().x402Support, true)
})

// --- the unregistered card, which is the whole point of the design ---------

test('an address with no agent still gets a card, not an error', () => {
  const c = card(null)
  assert.strictEqual(c.registered, false)
  assert.strictEqual(c.address, ADDRESS)
  assert.strictEqual(c.schema, 'tenda-agent-card/v1')
})

test('an unregistered card names itself after its address', () => {
  // Required field, no identity to take it from. Naming it after the address
  // stays honest — it invents no identity — and still distinguishes one card
  // from another, which a flat "Unregistered agent" would not.
  const c = card(null)
  assert.ok(c.name.includes(APP_INFO.name), 'the fallback name should say whose agent surface this is')
  assert.ok(c.name.includes(ADDRESS.slice(0, 6)), 'the fallback name should identify the address')
  assert.ok(c.name.includes(ADDRESS.slice(-4)))
  assert.ok(!c.name.includes(ADDRESS), 'the full address would make an unreadable name')
})

test('an unregistered card falls back to the shared brand description and image', () => {
  const c = card(null)
  assert.strictEqual(c.description, APP_INFO.description)
  assert.strictEqual(c.image, APP_INFO.external.logo)
})

test('an unregistered card offers no reputation endpoint', () => {
  // There is no user to have standing. A link to `/v1/users/null/standing`
  // would be a promise that 404s.
  assert.deepStrictEqual(
    services(card(null)).map((s) => s.type),
    ['tasks', 'openapi'],
  )
})

// --- the registered card ---------------------------------------------------

test("a registered agent supplies its OWN name, description and image", () => {
  const c = card(IDENTITY)
  assert.strictEqual(c.registered, true)
  assert.strictEqual(c.name, 'Scout')
  assert.strictEqual(c.description, IDENTITY.description)
  assert.strictEqual(c.image, IDENTITY.image)
})

test('a registered agent gains a reputation LINK pointing at ITS OWN standing', () => {
  const reputation = services(card(IDENTITY)).find((s) => s.type === 'reputation')
  assert.ok(reputation, 'a registered agent must advertise its standing')
  assert.strictEqual(reputation.url, `${BASE}/v1/users/${IDENTITY.user_id}/standing`)
})

test('EMPTY stored strings fall back rather than publishing a blank required field', () => {
  // `formatFullName` returns '' for an agent with no name; `bio` and
  // `avatar_url` are nullable and a UI can write ''. `??` would let all three
  // through as empty strings and break the required-field contract, so the
  // builder uses `||`. This is the test that tells those two operators apart.
  const c = buildAgentCard({
    address: ADDRESS,
    api_base_url: BASE,
    identity: { user_id: IDENTITY.user_id, name: '', description: '', image: '' },
  })
  assert.notStrictEqual(c.name, '')
  assert.strictEqual(c.description, APP_INFO.description)
  assert.strictEqual(c.image, APP_INFO.external.logo)
  assert.strictEqual(c.registered, true, 'an empty name does not make it unregistered')
})

test('NULL stored columns fall back the same way', () => {
  const c = buildAgentCard({
    address: ADDRESS,
    api_base_url: BASE,
    identity: { user_id: IDENTITY.user_id, name: 'Scout', description: null, image: null },
  })
  assert.strictEqual(c.description, APP_INFO.description)
  assert.strictEqual(c.image, APP_INFO.external.logo)
})

// --- the rule that keeps the document cheap --------------------------------

test('the card NEVER carries a reputation score, only a URL to one', () => {
  // A score in a document whose hash is committed on-chain means a chain write
  // per review. #82 is where that question lives; the card links instead.
  const json = JSON.stringify(card(IDENTITY))
  for (const forbidden of ['score', 'rating', 'review_score', 'standing_score']) {
    assert.ok(!json.includes(`"${forbidden}"`), `card must not carry a ${forbidden} field`)
  }
})

// --- everything derived, nothing literal -----------------------------------

test('wallet entries cover the manifest live EVM chains — derived, not listed', () => {
  const expected = CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status === 'live')
    .map((c) => Number(c.id.split(':')[1]))
  assert.deepStrictEqual(wallets(card()).map((w) => w.chainId), expected)
  assert.ok(expected.length > 0, 'the manifest should have at least one live EVM chain')
})

test('every live EVM manifest id yields a usable numeric chain id', () => {
  // The builder parses with the shared `evmChainNumericId`, which THROWS rather
  // than yielding NaN — so a malformed manifest id would fail this loudly here
  // rather than emit `"chainId": null` into a document readers parse. The
  // manifest validator refuses such an entry first; this is the second net.
  const live = CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status === 'live')
  assert.strictEqual(wallets(card()).length, live.length, 'a live EVM chain is missing from the card')
})

test('the document never names a Solana chain — a 0x address there is a different key space', () => {
  // Asserted on the SERIALISED document, not on a count. An earlier version
  // compared `wallets().length` to the live-EVM count, which is exactly what the
  // test above already asserts — so it could not fail for its own reason, and a
  // solana entry added anywhere OUTSIDE the wallet list would have passed it.
  const solana = CHAIN_MANIFEST.filter((c) => c.namespace === 'solana')
  assert.ok(solana.length > 0, 'the manifest should have Solana chains for this to mean anything')
  const json = JSON.stringify(card(IDENTITY))
  for (const chain of solana) {
    assert.ok(!json.includes(chain.id), `${chain.id} must not appear anywhere in the card`)
  }
  assert.ok(!json.includes('solana'), 'no solana namespace may appear in an eip155 document')
})

test('wallet entries exclude chains that are not live — the card claims settlement, not intent', () => {
  const planned = CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status !== 'live')
  assert.ok(planned.length > 0, 'the manifest should have a planned EVM chain for this to mean anything')
  const advertised = new Set(wallets(card()).map((w) => w.chainId))
  for (const c of planned) {
    const chainId = Number(c.id.split(':')[1])
    assert.ok(!advertised.has(chainId), `${c.id} is '${c.status}' and must not appear as a wallet`)
  }
})

test('capabilities come from the shared proof vocabulary', () => {
  assert.deepStrictEqual(card().capabilities.proof_types, PROOF_TYPES)
})

test('every service URL is built from the base URL passed in — no hardcoded host', () => {
  const c = buildAgentCard({ address: ADDRESS, api_base_url: 'https://other.test', identity: IDENTITY })
  for (const s of services(c)) {
    assert.ok(s.url.startsWith('https://other.test/'), `${s.url} ignored the configured base URL`)
  }
})

test('the address is echoed verbatim — the builder normalises nothing', () => {
  // Normalisation belongs to the route, once, before the lookup. A second
  // lowercase here would hide a caller that forgot to do it.
  const mixed = '0x00000000000000000000000000000000000000A1'
  const c = buildAgentCard({ address: mixed, api_base_url: BASE, identity: null })
  assert.strictEqual(c.address, mixed)
  for (const w of wallets(c)) assert.strictEqual(w.address, mixed)
})
