/**
 * GET /.well-known/agents/:address.json against the real app and database (#84).
 *
 * The unit suite covers the DOCUMENT; this covers everything the document
 * cannot see: that the route is mounted where an on-chain URI says it is, that
 * one wallet is one card whatever case the URL uses, that a HUMAN's address
 * never leaks a name from an /agents/ URL, and that the response carries the
 * headers a stranger's agent needs to actually consume it.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { ErrorCode } from '@tenda/shared'
import { getConfig } from '@server/config'
import { buildAgentCard } from '@server/features/agent-card'
import { servedPaths } from '../helpers/route-table'
import { TEST_DB_CONFIGURED, useTestApp, createUser, linkWallet, testEvmAddress } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** The URL an ERC-8004 `agentURI` points at. The `.json` suffix is part of the key. */
const cardUrl = (address: string) => `/.well-known/agents/${address}.json`

/** The same source the route reads, so the assertion cannot drift from the config. */
const API_BASE = getConfig().API_BASE_URL

/**
 * A unique address that genuinely CONTAINS alphabetic hex.
 *
 * `testEvmAddress()` is `0x` + zero padding + a small hex counter, so for low
 * counters it has no letters and `toUpperCase()` is a no-op. Both casing tests
 * below were silently comparing a string to itself and passed against a lookup
 * that does not fold case at all — caught by mutation, not by the suite. The
 * `deadbeef` prefix supplies the letters; the counter tail keeps it unique.
 */
function letteredAddress(): string {
  return `0xdeadbeef${testEvmAddress().slice(10)}`
}

/** Upper-cased body, `0x` intact — a legacy checksummed spelling. */
function shout(address: string): string {
  const upper = `0x${address.slice(2).toUpperCase()}`
  // The fixture asserts its own premise: if these ever coincide again, the test
  // that depends on them differing must fail loudly rather than pass vacuously.
  assert.notStrictEqual(upper, address, 'fixture must produce two distinct spellings')
  return upper
}

/** Creates the agent and returns ITS user id — the card must point at that one. */
async function agentWithWallet(address: string): Promise<string> {
  const app = getApp()
  const { row } = await createUser(app, { first_name: 'Scout', last_name: '', is_agent: true })
  await linkWallet(app, row.id, { chain_ns: 'eip155', address })
  return row.id
}

test('a registered agent gets a card carrying its name and ITS OWN reputation URL', { skip }, async () => {
  const address = testEvmAddress()
  const user_id = await agentWithWallet(address)

  const res = await getApp().inject({ method: 'GET', url: cardUrl(address) })
  assert.strictEqual(res.statusCode, 200)
  const card = res.json()
  assert.strictEqual(card.registered, true)
  assert.strictEqual(card.name, 'Scout')
  assert.strictEqual(card.address, address.toLowerCase())
  // The full path, not `endsWith('/standing')` — that suffix is identical for
  // EVERY user, so it passes just as well when the store maps the card to the
  // wrong agent, which is a card advertising someone else's standing. Mutation
  // M8 (user_id -> a constant) survived the weaker assertion.
  assert.strictEqual(card.endpoints.reputation, `${API_BASE}/v1/users/${user_id}/standing`)
})

test('an unknown address gets a MINIMAL card, never a 404', { skip }, async () => {
  // The decisive property: the URI is committed on-chain at mint time, before
  // any Tenda-side registration exists. A 404 in that window is a pointer that
  // reads as broken to a registry that just recorded it.
  const res = await getApp().inject({ method: 'GET', url: cardUrl(testEvmAddress()) })
  assert.strictEqual(res.statusCode, 200)
  const card = res.json()
  assert.strictEqual(card.registered, false)
  assert.strictEqual(card.name, undefined)
  assert.ok(Array.isArray(card.accounts) && card.accounts.length > 0)
})

test("a HUMAN's wallet reads as unregistered — a name must not leak from /agents/", { skip }, async () => {
  // The card carries a name and anyone may hold an address. Serving a person's
  // name because they happen to own one would be a leak, so `is_agent` is a
  // filter in the store and not a display concern.
  const app = getApp()
  const address = testEvmAddress()
  const { row } = await createUser(app, { first_name: 'Ada', last_name: 'Lovelace', is_agent: false })
  await linkWallet(app, row.id, { chain_ns: 'eip155', address })

  const card = (await app.inject({ method: 'GET', url: cardUrl(address) })).json()
  assert.strictEqual(card.registered, false)
  assert.strictEqual(card.name, undefined)
  assert.ok(!JSON.stringify(card).includes('Ada'), 'a human name must never appear in an agent card')
})

test('a checksummed URL and a lowercase one are ONE document', { skip }, async () => {
  // EIP-55 casing is a display convention; the same wallet arrives both ways.
  // Two documents for one agent would mean two cache entries and, worse, one
  // of them 404-ing depending on which spelling a registry recorded.
  const address = letteredAddress()
  await agentWithWallet(address)

  const lower = await getApp().inject({ method: 'GET', url: cardUrl(address) })
  const upper = await getApp().inject({ method: 'GET', url: cardUrl(shout(address)) })
  assert.strictEqual(lower.statusCode, 200)
  assert.strictEqual(upper.statusCode, 200)
  assert.deepStrictEqual(upper.json(), lower.json())
})

test('a LEGACY checksummed row still resolves — the reason the lookup folds case', { skip }, async () => {
  // Storage is normalised GOING FORWARD only (lib/auth/wallet-address), so rows
  // written before that change are still checksummed. Every other test here
  // inserts a lowercase address, so an exact-match lookup would pass all of
  // them and still 404 a real agent whose URI is already committed on-chain.
  // This is the only case that can tell those two implementations apart.
  const app = getApp()
  const lower = letteredAddress()
  const checksummed = shout(lower)
  const { row } = await createUser(app, { first_name: 'Legacy', last_name: '', is_agent: true })
  await linkWallet(app, row.id, { chain_ns: 'eip155', address: checksummed })

  const card = (await app.inject({ method: 'GET', url: cardUrl(lower) })).json()
  assert.strictEqual(card.registered, true, 'a checksummed stored row must still be found')
  assert.strictEqual(card.name, 'Legacy')
})

test('a path that is not an EVM address is refused before any query', { skip }, async () => {
  const app = getApp()
  for (const bad of ['not-an-address', '0x123', `${'0x' + 'f'.repeat(41)}`, '', '..', '%2e%2e']) {
    const res = await app.inject({ method: 'GET', url: `/.well-known/agents/${bad}.json` })
    assert.ok(res.statusCode === 404, `${JSON.stringify(bad)} should 404, got ${res.statusCode}`)
  }
})

test('the `.json` suffix is REQUIRED — one URL per document, not two', { skip }, async () => {
  // The suffix is part of the key, not Accept negotiation: `agentURI` is
  // committed ON-CHAIN, so exactly one spelling may serve. Answering the bare
  // address too would give one agent two URLs and two cache entries, and would
  // diverge from /.well-known/assetlinks.json, which is registered with its
  // literal suffix and serves no bare form either.
  const address = testEvmAddress()
  await agentWithWallet(address)

  assert.strictEqual((await getApp().inject({ method: 'GET', url: cardUrl(address) })).statusCode, 200)
  const bare = await getApp().inject({ method: 'GET', url: `/.well-known/agents/${address}` })
  assert.strictEqual(bare.statusCode, 404, 'the bare address must not serve the card')
})

test('a refused path answers in the app-wide error envelope', { skip }, async () => {
  // Every other route 404s by throwing AppError, which the shared handler
  // renders as four fields. A route that hand-rolls `{ error, message }` gives
  // clients that discriminate on `code` an undefined to switch on.
  const res = await getApp().inject({ method: 'GET', url: '/.well-known/agents/not-an-address.json' })
  assert.strictEqual(res.statusCode, 404)
  const body = res.json()
  assert.strictEqual(body.statusCode, 404)
  assert.strictEqual(body.error, 'Not Found')
  assert.strictEqual(body.code, ErrorCode.NOT_FOUND)
  assert.strictEqual(typeof body.message, 'string')
})

test('the response carries the headers a stranger fetching it needs', { skip }, async () => {
  const res = await getApp().inject({ method: 'GET', url: cardUrl(testEvmAddress()) })
  assert.match(String(res.headers['content-type']), /application\/json/)
  // Public data fetched cross-origin by other people's agents and by browsers.
  assert.strictEqual(res.headers['access-control-allow-origin'], '*')
  assert.match(String(res.headers['cache-control']), /max-age=\d+/)
})

test('the card is readable cross-origin even from an origin the CORS allowlist rejects', { skip }, async () => {
  // The app's CORS plugin runs an ALLOWLIST (CORS_ORIGIN u ADMIN_ORIGIN). A
  // well-known document is the one surface that must ignore it: it is public
  // data fetched by strangers' agents and by registries from origins we can
  // never enumerate. This route therefore sets `*` itself — and this asserts the
  // plugin does not overwrite it, which is the only thing that could make the
  // deliberate exception silently not apply.
  const res = await getApp().inject({
    method: 'GET',
    url: cardUrl(testEvmAddress()),
    headers: { origin: 'https://a-stranger.example' },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['access-control-allow-origin'], '*')
})

test('every URL the card advertises is a path this server actually serves', { skip }, async () => {
  // The card is the fourth consumer of this server's routes, and the only one
  // no route MAP covers: its URLs are committed ON-CHAIN as `agentURI`, so a
  // renamed route turns a signed pointer into a 404 that costs a transaction to
  // correct. api-routes-drift.test.ts guards the client maps; this guards the
  // promise the card makes to strangers.
  const USER_ID = '00000000-0000-4000-8000-0000000000ff'
  const served = servedPaths(getApp())
  // The helper's own docblock: a parser can silently return nothing, which
  // would make every assertion below pass while checking nothing.
  assert.ok(served.size > 10, 'the route-table parse produced nothing to check against')

  const card = buildAgentCard({
    address: testEvmAddress(),
    api_base_url: API_BASE,
    identity: { user_id: USER_ID, name: 'Scout' },
  })
  const urls = Object.values(card.endpoints)
  assert.strictEqual(urls.length, 3, 'every endpoint on the card must be checked, not some of them')

  for (const url of urls) {
    assert.ok(url.startsWith(`${API_BASE}/`), `${url} is not under the configured base URL`)
    // Back to the parameterised form the route table stores.
    const path = url.slice(API_BASE.length).replace(USER_ID, ':id')
    assert.ok(served.has(path), `the card advertises ${path}, which this server does not serve`)
  }
})

test('a row under another NAMESPACE does not answer the EVM card', { skip }, async () => {
  // The lookup is namespace-pinned, and this stores the SAME string under
  // `solana` so the pin is the only thing that can refuse it.
  //
  // The earlier version of this test linked a real (base58) Solana wallet and
  // asked for an unrelated EVM address, so the row failed the ADDRESS predicate
  // and the namespace filter was never reached — deleting that filter left the
  // test green. Mutation I-c caught it. A base58 address can never spell
  // `0x…` (the alphabet omits `0`), so a fixture is the only way to exercise
  // this at all; that is an argument for writing the fixture, not for trusting
  // an unexercised guard on a route whose URL is committed on-chain.
  const app = getApp()
  const evm = testEvmAddress()
  const { row } = await createUser(app, { first_name: 'Solo', last_name: '', is_agent: true })
  await linkWallet(app, row.id, { chain_ns: 'solana', address: evm })

  const card = (await app.inject({ method: 'GET', url: cardUrl(evm) })).json()
  assert.strictEqual(card.registered, false, 'an eip155 lookup must not match a solana row')
  assert.strictEqual(card.name, undefined)
})
