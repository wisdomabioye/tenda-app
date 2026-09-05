/**
 * The agent card document (#84) — `buildAgentCard` is pure, so this suite needs
 * no app, no database and no clock.
 *
 * WHAT IS ACTUALLY BEING GUARDED. The card's URI is committed ON-CHAIN by an
 * ERC-8004 mint, so its shape is a promise that cannot be withdrawn cheaply.
 * Two properties matter more than the field list: it must never carry a
 * reputation SCORE (that would mean a chain write per review), and every
 * derived field must come from a shared source rather than a literal, so a new
 * chain or a new proof type reaches the card without anyone editing it.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { CHAIN_MANIFEST, PROOF_TYPES } from '@tenda/shared'
import { buildAgentCard } from '@server/features/agent-card'

const ADDRESS = '0x00000000000000000000000000000000000000a1'
const BASE = 'https://api.example.test'
const IDENTITY = { user_id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Scout' }

const card = (identity: { user_id: string; name: string } | null = null) =>
  buildAgentCard({ address: ADDRESS, api_base_url: BASE, identity })

// --- the unregistered card, which is the whole point of the design ---------

test('an address with no agent still gets a card, not an error', () => {
  // The URI is committed at MINT time, before any Tenda registration can exist.
  // A 404 in that window is an on-chain pointer that reads as broken.
  const c = card(null)
  assert.strictEqual(c.registered, false)
  assert.strictEqual(c.address, ADDRESS)
  assert.strictEqual(c.schema, 'tenda-agent-card/v1')
})

test('an unregistered card omits name and reputation entirely — no empty strings', () => {
  // Absent, not blank: a reader distinguishes "no name" from "" only if the key
  // is missing, and JSON consumers routinely treat '' as a present value.
  const c = card(null)
  assert.ok(!('name' in c), 'name must be absent')
  assert.ok(!('reputation' in c.endpoints), 'reputation must be absent')
})

test('a registered agent gains its name and a reputation LINK', () => {
  const c = card(IDENTITY)
  assert.strictEqual(c.registered, true)
  assert.strictEqual(c.name, 'Scout')
  assert.strictEqual(c.endpoints.reputation, `${BASE}/v1/users/${IDENTITY.user_id}/standing`)
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

test('accounts are CAIP-10 over the manifest live EVM chains — derived, not listed', () => {
  const expected = CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status === 'live')
    .map((c) => `${c.id}:${ADDRESS}`)
  assert.deepStrictEqual(card().accounts, expected)
  assert.ok(expected.length > 0, 'the manifest should have at least one live EVM chain')
})

test('accounts never name a Solana chain — a 0x address there is a different key space', () => {
  assert.deepStrictEqual(card().accounts.filter((a) => a.startsWith('solana:')), [])
})

test('accounts exclude chains that are not live — the card claims settlement, not intent', () => {
  const planned = CHAIN_MANIFEST.filter((c) => c.namespace === 'eip155' && c.status !== 'live')
  for (const c of planned) {
    assert.ok(
      !card().accounts.some((a) => a.startsWith(`${c.id}:`)),
      `${c.id} is '${c.status}' and must not appear as a settlement account`,
    )
  }
})

test('capabilities come from the shared proof vocabulary', () => {
  assert.deepStrictEqual(card().capabilities.proof_types, PROOF_TYPES)
})

test('every endpoint is built from the base URL passed in — no hardcoded host', () => {
  const c = buildAgentCard({ address: ADDRESS, api_base_url: 'https://other.test', identity: IDENTITY })
  for (const url of Object.values(c.endpoints)) {
    assert.ok(url.startsWith('https://other.test/'), `${url} ignored the configured base URL`)
  }
})

test('the address is echoed verbatim — the builder normalises nothing', () => {
  // Normalisation belongs to the route, once, before the lookup. A second
  // lowercase here would hide a caller that forgot to do it.
  const mixed = '0x00000000000000000000000000000000000000A1'
  assert.strictEqual(
    buildAgentCard({ address: mixed, api_base_url: BASE, identity: null }).address,
    mixed,
  )
})
