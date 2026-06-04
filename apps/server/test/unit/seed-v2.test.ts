/**
 * db/seed-v2 — pure row builder. The I/O wrapper is a thin
 * onConflictDoNothing pass; the values are what need guarding.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { ESCROW_IDL } from '@tenda/shared/idl'
import { buildSeedRows } from '@server/db/seed-v2'

const CONFIG = {
  SOLANA_TREASURY_ADDRESS: 'Treas1111111111111111111111111111111111111',
  SOLANA_USDC_MINT: 'Mint11111111111111111111111111111111111111',
  // Stage 3 — unset by default; the BASE test below opts in.
  BASE_ESCROW_ADDR: null,
  BASE_USDC_ADDR: null,
  MULTISIG_BASE_ADDR: null,
}

const BASE_CONFIG = {
  ...CONFIG,
  BASE_ESCROW_ADDR: '0x00000000000000000000000000000000000000e5',
  BASE_USDC_ADDR: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  MULTISIG_BASE_ADDR: '0x00000000000000000000000000000000000000a1',
}

test('seeds both Solana networks with the IDL program id + configured treasury', () => {
  const rows = buildSeedRows(CONFIG, 'solana:devnet')
  assert.deepStrictEqual(
    rows.chains.map((c) => c.id).sort(),
    ['solana:devnet', 'solana:mainnet'],
  )
  for (const c of rows.chains) {
    assert.strictEqual(c.escrow_program, ESCROW_IDL.address)
    assert.strictEqual(c.treasury_address, CONFIG.SOLANA_TREASURY_ADDRESS)
    // Gas-seed pair stays unset until #40 (paired CHECK constraint).
    assert.strictEqual(c.gas_seed_amount_raw, undefined)
    assert.strictEqual(c.gas_seed_wallet_address, undefined)
  }
})

test('native SOL rows per network; USDC bound to the active network only', () => {
  const rows = buildSeedRows(CONFIG, 'solana:devnet')
  const usdc = rows.assets.find((a) => a.id === 'USDC_SOL')
  assert.ok(usdc)
  assert.strictEqual(usdc.chain_id, 'solana:devnet')
  assert.strictEqual(usdc.token_address, CONFIG.SOLANA_USDC_MINT)
  assert.strictEqual(usdc.decimals, 6)
  assert.strictEqual(usdc.is_stable, true)

  const natives = rows.assets.filter((a) => a.token_address === null)
  assert.strictEqual(natives.length, 2)
  assert.ok(natives.every((a) => a.decimals === 9))
  assert.strictEqual(rows.skipped.length, 0)
})

test('missing USDC mint → asset skipped with a named warning, never silently', () => {
  const rows = buildSeedRows({ ...CONFIG, SOLANA_USDC_MINT: null }, 'solana:mainnet')
  assert.strictEqual(rows.assets.some((a) => a.id === 'USDC_SOL'), false)
  assert.strictEqual(rows.skipped.length, 1)
  assert.match(rows.skipped[0], /USDC_SOL/)
})

test('mainnet deployment binds USDC to solana:mainnet', () => {
  const rows = buildSeedRows(CONFIG, 'solana:mainnet')
  assert.strictEqual(rows.assets.find((a) => a.id === 'USDC_SOL')?.chain_id, 'solana:mainnet')
})

test('BASE rows are env-gated: silent when unset, loud when half-configured, full set when configured', () => {
  const unset = buildSeedRows(CONFIG, 'solana:devnet')
  assert.ok(!unset.chains.some((c) => c.id === 'eip155:8453'))
  assert.strictEqual(unset.skipped.length, 0) // fully unset = normal, not a warning

  const half = buildSeedRows({ ...CONFIG, BASE_ESCROW_ADDR: '0xe5' }, 'solana:devnet')
  assert.ok(!half.chains.some((c) => c.id === 'eip155:8453'))
  assert.ok(half.skipped.some((m) => m.includes('must both be set')))

  const set = buildSeedRows(BASE_CONFIG, 'solana:devnet')
  const base = set.chains.find((c) => c.id === 'eip155:8453')
  assert.ok(base)
  assert.strictEqual(base.escrow_program, BASE_CONFIG.BASE_ESCROW_ADDR)
  assert.strictEqual(base.treasury_address, BASE_CONFIG.MULTISIG_BASE_ADDR)
  const usdc = set.assets.find((a) => a.id === 'USDC_BASE')
  const eth = set.assets.find((a) => a.id === 'ETH_BASE')
  assert.ok(usdc && usdc.decimals === 6 && usdc.is_stable === true)
  assert.ok(eth && eth.decimals === 18 && eth.token_address === null)
})

test('BASE without the USDC address seeds the chain + ETH, skips USDC loudly', () => {
  const rows = buildSeedRows({ ...BASE_CONFIG, BASE_USDC_ADDR: null }, 'solana:devnet')
  assert.ok(rows.chains.some((c) => c.id === 'eip155:8453'))
  assert.ok(!rows.assets.some((a) => a.id === 'USDC_BASE'))
  assert.ok(rows.assets.some((a) => a.id === 'ETH_BASE'))
  assert.ok(rows.skipped.some((m) => m.includes('USDC_BASE')))
})
