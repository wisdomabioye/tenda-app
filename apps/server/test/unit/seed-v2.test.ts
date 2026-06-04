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
