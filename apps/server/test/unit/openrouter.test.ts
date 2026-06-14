/**
 * #98 gap-fill — moderation OpenRouter provider. The provider takes a
 * ChatTransport seam, so the classify/verdict logic is tested with a fake
 * transport (no network); the fetch-backed transport is tested separately
 * with a mocked global fetch.
 */
import { test, afterEach } from 'node:test'
import assert from 'node:assert'
import {
  openRouterProvider,
  openRouterTransport,
  displayAmount,
  type ChatTransport,
} from '@server/features/moderation/providers/openrouter'
import type { ModerationInput, PriceStats } from '@server/features/moderation/types'

const INPUT: ModerationInput = {
  title: 'Fix my sink', description: 'basic plumbing', category: 'service',
  country: 'NG', asset: 'USDC_SOL', amount_raw: '5000000', asset_decimals: 6,
}
const STATS: PriceStats = { p10_raw: '1000000', p50_raw: '5000000', p90_raw: '10000000', sample_size: 20 }

/** Fake transport returning the queued responses in order (last repeats). */
function transport(...responses: string[]): ChatTransport {
  let i = 0
  return { complete: () => Promise.resolve(responses[Math.min(i++, responses.length - 1)]!) }
}

// ---------- contentSafety --------------------------------------------------------

test('contentSafety: a high-confidence "blocked" verdict maps to decision=block', async () => {
  const p = openRouterProvider(transport('{"classification":"blocked","confidence":0.95,"reason":"fraud service"}'))
  const v = await p.contentSafety!(INPUT)
  assert.strictEqual(v?.decision, 'block')
  assert.strictEqual(v?.reasons[0]?.message, 'fraud service')
})

test('contentSafety: "suspicious" → warn, "safe" → approve', async () => {
  const warn = await openRouterProvider(transport('{"classification":"suspicious","confidence":0.9}')).contentSafety!(INPUT)
  assert.strictEqual(warn?.decision, 'warn')
  const ok = await openRouterProvider(transport('{"classification":"safe","confidence":0.9}')).contentSafety!(INPUT)
  assert.strictEqual(ok?.decision, 'approve')
  assert.deepStrictEqual(ok?.reasons, [])
})

test('contentSafety: an unexpected classification is inconclusive (null)', async () => {
  const v = await openRouterProvider(transport('{"classification":"banana","confidence":0.9}')).contentSafety!(INPUT)
  assert.strictEqual(v, null)
})

test('contentSafety: non-JSON model output is inconclusive (null)', async () => {
  const v = await openRouterProvider(transport('I cannot help with that')).contentSafety!(INPUT)
  assert.strictEqual(v, null)
})

test('contentSafety: markdown-fenced JSON is stripped and parsed', async () => {
  const v = await openRouterProvider(transport('```json\n{"classification":"safe","confidence":0.9}\n```')).contentSafety!(INPUT)
  assert.strictEqual(v?.decision, 'approve')
})

test('contentSafety: low-confidence primary escalates and adopts the stronger model', async () => {
  const p = openRouterProvider(transport(
    '{"classification":"suspicious","confidence":0.4}', // below 0.7 → escalate
    '{"classification":"blocked","confidence":0.95,"reason":"on review, blocked"}',
  ))
  const v = await p.contentSafety!(INPUT)
  assert.strictEqual(v?.decision, 'block')
  assert.strictEqual(v?.model, 'anthropic/claude-sonnet-4.5')
})

test('contentSafety: a low-confidence escalation that fails to parse keeps the primary verdict', async () => {
  const p = openRouterProvider(transport(
    '{"classification":"suspicious","confidence":0.4}',
    'garbage-not-json',
  ))
  const v = await p.contentSafety!(INPUT)
  assert.strictEqual(v?.decision, 'warn')
  assert.strictEqual(v?.model, 'anthropic/claude-haiku-4.5') // unchanged
})

// ---------- priceSanity ----------------------------------------------------------

test('priceSanity: too_low / too_high → warn, plausible → approve, other → null', async () => {
  const low = await openRouterProvider(transport('{"assessment":"too_low","confidence":0.9}')).priceSanity!(INPUT, STATS)
  assert.strictEqual(low?.reasons[0]?.code, 'PRICE_TOO_LOW')
  const high = await openRouterProvider(transport('{"assessment":"too_high","confidence":0.9}')).priceSanity!(INPUT, STATS)
  assert.strictEqual(high?.reasons[0]?.code, 'PRICE_TOO_HIGH')
  const ok = await openRouterProvider(transport('{"assessment":"plausible","confidence":0.9}')).priceSanity!(INPUT, STATS)
  assert.strictEqual(ok?.decision, 'approve')
  const weird = await openRouterProvider(transport('{"assessment":"???"}')).priceSanity!(INPUT, STATS)
  assert.strictEqual(weird, null)
})

// ---------- openRouterTransport (fetch) ------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

test('openRouterTransport: returns the assistant content on a 200', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(jsonResponse(200, { choices: [{ message: { content: 'hello' } }] }))) as typeof fetch
  const out = await openRouterTransport('key').complete({ model: 'm', system: 's', user: 'u', timeout_ms: 5000 })
  assert.strictEqual(out, 'hello')
})

test('openRouterTransport: a non-OK response throws 502', async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(500, 'err'))) as typeof fetch
  await assert.rejects(
    openRouterTransport('key').complete({ model: 'm', system: 's', user: 'u', timeout_ms: 5000 }),
    (e: { statusCode?: number }) => e.statusCode === 502,
  )
})

test('openRouterTransport: a 200 with no content throws 502', async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(200, { choices: [] }))) as typeof fetch
  await assert.rejects(
    openRouterTransport('key').complete({ model: 'm', system: 's', user: 'u', timeout_ms: 5000 }),
    (e: { statusCode?: number }) => e.statusCode === 502,
  )
})

// ---------- displayAmount --------------------------------------------------------

test('displayAmount: converts raw base units to display units', () => {
  assert.strictEqual(displayAmount({ amount_raw: '5000000', asset_decimals: 6 }), 5)
  assert.strictEqual(displayAmount({ amount_raw: '1500000000', asset_decimals: 9 }), 1.5)
})
