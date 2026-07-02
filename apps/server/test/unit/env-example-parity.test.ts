/**
 * Machine-checks the parts of .env.example that CAN rot silently (the EVM
 * deploy runbook documented BASE_*-era names long after the loader moved to
 * CHAIN_*; prose can't be tested, but the example file can):
 *   1. every CHAIN_* key it documents is a key the secrets loader reads, and
 *   2. every boot-required var is documented.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REQUIRED_ENV_VARS } from '@server/config'
import { knownChainEnvKeys } from '@server/chains/secrets'

/** Env-var names documented in .env.example, commented-out lines included. */
function documentedKeys(): Set<string> {
  const raw = readFileSync(join(__dirname, '../../.env.example'), 'utf8')
  const keys = new Set<string>()
  for (const line of raw.split('\n')) {
    const match = /^#?([A-Z][A-Z0-9_]*)=/.exec(line.trim())
    if (match !== null) keys.add(match[1])
  }
  return keys
}

test('every CHAIN_* var documented in .env.example is one the secrets loader reads', () => {
  const known = knownChainEnvKeys()
  const documented = [...documentedKeys()].filter((k) => k.startsWith('CHAIN_'))
  assert.ok(documented.length > 0, 'expected .env.example to document chain vars')
  const unknown = documented.filter((k) => !known.has(k))
  assert.deepStrictEqual(
    unknown,
    [],
    `stale chain env names in .env.example (the loader would reject these at boot): ${unknown.join(', ')}`,
  )
})

test('every boot-required env var is documented in .env.example', () => {
  const documented = documentedKeys()
  const missing = REQUIRED_ENV_VARS.filter((k) => !documented.has(k))
  assert.deepStrictEqual(missing, [], `undocumented required vars: ${missing.join(', ')}`)
})
