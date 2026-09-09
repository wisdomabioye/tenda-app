/**
 * lib/env.ts — the two rules every env reader agrees on: blank means absent,
 * and a URL from env must be genuinely absolute. The URL cases that matter are
 * the ones plain `new URL()` accepts; this helper exists to reject those.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { integerRangeProblem, isAbsoluteUrl, optionalEnv, positiveIntegerEnv, positiveIntegerProblem, stripTrailingSlash, urlEnvProblems } from '@server/lib/env'

const HTTPS = ['https'] as const
const HTTP_S = ['https', 'http'] as const

// ── optionalEnv ────────────────────────────────────────────────────────────
// `env` is a parameter, so these never touch process.env.

test('optionalEnv returns the trimmed value when set', () => {
  assert.strictEqual(optionalEnv('K', { K: '  value  ' }), 'value')
})

test('optionalEnv treats unset, empty, and whitespace-only alike as absent', () => {
  // The rule that matters: a blank var must read as "not configured", never
  // as a configured empty string (that became a '' base URL once already).
  assert.strictEqual(optionalEnv('K', {}), null)
  assert.strictEqual(optionalEnv('K', { K: '' }), null)
  assert.strictEqual(optionalEnv('K', { K: '   ' }), null)
  assert.strictEqual(optionalEnv('K', { K: '\t\n' }), null)
})

test('optionalEnv defaults to process.env', () => {
  const key = 'TENDA_OPTIONAL_ENV_PROBE'
  try {
    process.env[key] = ' probe '
    assert.strictEqual(optionalEnv(key), 'probe')
  } finally {
    delete process.env[key]
  }
  assert.strictEqual(optionalEnv(key), null)
})

// ── isAbsoluteUrl ──────────────────────────────────────────────────────────

test('isAbsoluteUrl accepts a well-formed URL on an allowed scheme', () => {
  assert.strictEqual(isAbsoluteUrl('https://hooks.slack.com/services/T/B/x', HTTPS), true)
  assert.strictEqual(isAbsoluteUrl('https://admin.tenda.app', HTTP_S), true)
  assert.strictEqual(isAbsoluteUrl('http://localhost:3001', HTTP_S), true)
})

test('isAbsoluteUrl rejects a scheme that is not allowed', () => {
  // Parses fine, wrong scheme — an http webhook would leak dispute context.
  assert.strictEqual(isAbsoluteUrl('http://hooks.slack.com/x', HTTPS), false)
  assert.strictEqual(isAbsoluteUrl('ftp://example.com/x', HTTP_S), false)
})

test('isAbsoluteUrl rejects the missing-slashes typo that new URL() accepts', () => {
  // The reason this helper exists: `new URL` parses this happily, protocol
  // 'https:' and host 'admin.tenda.app', so a protocol-only check passes it.
  assert.strictEqual(new URL('https:admin.tenda.app/x').protocol, 'https:')
  assert.strictEqual(isAbsoluteUrl('https:admin.tenda.app/x', HTTP_S), false)
})

test('isAbsoluteUrl rejects unparseable and non-absolute values', () => {
  assert.strictEqual(isAbsoluteUrl('https://[', HTTPS), false)     // parse throws
  assert.strictEqual(isAbsoluteUrl('https://', HTTPS), false)      // no host
  assert.strictEqual(isAbsoluteUrl('admin.tenda.app', HTTP_S), false)
  assert.strictEqual(isAbsoluteUrl('/disputes/1', HTTP_S), false)
  assert.strictEqual(isAbsoluteUrl('', HTTP_S), false)
})

test('isAbsoluteUrl is scheme-case-insensitive', () => {
  assert.strictEqual(isAbsoluteUrl('HTTPS://hooks.slack.com/x', HTTPS), true)
})

test('isAbsoluteUrl rejects everything when no scheme is allowed', () => {
  assert.strictEqual(isAbsoluteUrl('https://admin.tenda.app', []), false)
})

// ── urlEnvProblems ─────────────────────────────────────────────────────────
// The loud half every boot check shares: absent is silence, malformed is not.

test('urlEnvProblems: no problems when vars are absent, blank, or valid', () => {
  assert.deepStrictEqual(urlEnvProblems(['A', 'B'], HTTPS, {}), [])
  assert.deepStrictEqual(urlEnvProblems(['A'], HTTPS, { A: '   ' }), [])
  assert.deepStrictEqual(urlEnvProblems(['A'], HTTPS, { A: 'https://ok.example' }), [])
})

test('urlEnvProblems: names the exact env key and the schemes it wanted', () => {
  assert.deepStrictEqual(urlEnvProblems(['A'], HTTPS, { A: 'http://x' }), [
    'A is set but is not an absolute https URL',
  ])
  assert.deepStrictEqual(urlEnvProblems(['A'], HTTP_S, { A: 'ftp://x' }), [
    'A is set but is not an absolute https or http URL',
  ])
})

test('urlEnvProblems: reports every bad var, not just the first', () => {
  // Boot aggregates problems so an operator fixes them in one pass.
  assert.deepStrictEqual(urlEnvProblems(['A', 'B'], HTTPS, { A: 'nope', B: 'also-nope' }), [
    'A is set but is not an absolute https URL',
    'B is set but is not an absolute https URL',
  ])
})

test('urlEnvProblems: accepts any iterable of keys (Set, as the Slack registry returns)', () => {
  assert.deepStrictEqual(urlEnvProblems(new Set(['A']), HTTPS, { A: 'nope' }), [
    'A is set but is not an absolute https URL',
  ])
})

// ── stripTrailingSlash ─────────────────────────────────────────────────────

test('stripTrailingSlash removes exactly one trailing slash', () => {
  assert.strictEqual(stripTrailingSlash('https://admin.tenda.app/'), 'https://admin.tenda.app')
  assert.strictEqual(stripTrailingSlash('https://admin.tenda.app'), 'https://admin.tenda.app')
  // Only one: '//' is a caller error, not something to silently normalise away.
  assert.strictEqual(stripTrailingSlash('https://admin.tenda.app//'), 'https://admin.tenda.app/')
  assert.strictEqual(stripTrailingSlash(''), '')
})

// ---------- positive-integer vars (moved here from config.ts at #147) ----------

test('positiveIntegerEnv: the fallback when unset or blank, the value when a positive integer', () => {
  assert.strictEqual(positiveIntegerEnv('N', 20, {}), 20)
  assert.strictEqual(positiveIntegerEnv('N', 20, { N: '   ' }), 20)
  assert.strictEqual(positiveIntegerEnv('N', 20, { N: '7' }), 7)
  assert.strictEqual(positiveIntegerEnv('N', 20, { N: ' 42 ' }), 42)
})

test('positiveIntegerEnv: a set-but-malformed value answers the fallback — refusing it is positiveIntegerProblem\'s job', () => {
  // '1e3' is NOT here: Number('1e3') is 1000, a safe positive integer, and the
  // helper has always accepted it — pinned below so the boundary is on record.
  for (const bad of ['0', '-1', '2.5', 'many', String(Number.MAX_SAFE_INTEGER + 2)]) {
    assert.strictEqual(positiveIntegerEnv('N', 20, { N: bad }), 20, bad)
    assert.deepStrictEqual(positiveIntegerProblem('N', { N: bad }), ['N must be a positive integer'], bad)
  }
})

test('positiveIntegerProblem: nothing to report when unset, blank or well-formed', () => {
  assert.strictEqual(positiveIntegerEnv('N', 20, { N: '1e3' }), 1000)
  assert.deepStrictEqual(positiveIntegerProblem('N', {}), [])
  assert.deepStrictEqual(positiveIntegerProblem('N', { N: '' }), [])
  assert.deepStrictEqual(positiveIntegerProblem('N', { N: '3' }), [])
})

// ---------- integerRangeProblem (the endpoints-inclusive sibling) -------------

test('integerRangeProblem: an unset or blank var is never a problem', () => {
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, {}), [])
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, { N: '   ' }), [])
})

test('integerRangeProblem: BOTH endpoints are legal — the reason it is not positiveIntegerProblem', () => {
  // Zero is the case that forced this to exist: PLATFORM_FEE_BPS=0 is a
  // deployment that charges nothing, and the positive-integer check refuses it.
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, { N: '0' }), [])
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, { N: '10000' }), [])
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, { N: ' 250 ' }), [])
  assert.deepStrictEqual(positiveIntegerProblem('N', { N: '0' }), ['N must be a positive integer'])
})

test('integerRangeProblem: names the var and the range it wanted', () => {
  for (const bad of ['-1', '10001', '2.5', '2.5%', 'free', String(Number.MAX_SAFE_INTEGER + 2)]) {
    assert.deepStrictEqual(
      integerRangeProblem('N', 0, 10_000, { N: bad }),
      ['N must be an integer between 0 and 10000'],
      bad,
    )
  }
})

test('integerRangeProblem: exponent notation parses, exactly as positiveIntegerEnv does', () => {
  // Pinned rather than fixed: Number('1e3') is 1000, a safe integer in range,
  // and the sibling above has always accepted it. Recording the boundary is
  // what stops the two from drifting apart silently.
  assert.deepStrictEqual(integerRangeProblem('N', 0, 10_000, { N: '1e3' }), [])
})

test('integerRangeProblem: defaults to process.env like every other reader here', () => {
  const key = 'TENDA_RANGE_ENV_PROBE'
  try {
    process.env[key] = '99999'
    assert.deepStrictEqual(integerRangeProblem(key, 0, 10_000), [`${key} must be an integer between 0 and 10000`])
  } finally {
    delete process.env[key]
  }
  assert.deepStrictEqual(integerRangeProblem(key, 0, 10_000), [])
})
