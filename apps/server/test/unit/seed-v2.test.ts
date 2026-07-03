/**
 * db/seed-v2 — pure row builder over the ACTIVE chain secrets + the shared
 * manifest; the row VALUES are what need guarding here. The I/O wrapper
 * (applySeed — registry-fact upserts + enablement reconcile) is DB-tested in
 * integration/seed-upsert.test.ts. Secrets are built through the real loader.
 * Partial / malformed config is rejected upstream by the loader (see
 * secrets.test), so the seeder only ever sees clean, active chains.
 */
import { test } from 'node:test'
import * as assert from 'node:assert'
import { ESCROW_IDL } from '@tenda/shared/idl'
import { buildSeedRows } from '@server/db/seed-v2'
import { loadChainSecrets } from '@server/chains/secrets'

const SOL = 'So11111111111111111111111111111111111111112'
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // canonical USDC mint shape
const EVM_ESCROW = '0x00000000000000000000000000000000000000e5'
const EVM_TREASURY = '0x00000000000000000000000000000000000000a1'
const RPC = 'https://rpc.example'

const solDevnet = (extra: NodeJS.ProcessEnv = {}) =>
  loadChainSecrets({ CHAIN_SOLANA_DEVNET_RPC_URL: RPC, CHAIN_SOLANA_DEVNET_TREASURY_ADDR: SOL, ...extra })
const baseMainnet = () =>
  loadChainSecrets({
    CHAIN_EIP155_8453_RPC_URL: RPC,
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM_ESCROW,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM_TREASURY,
  })
const celoMainnet = () =>
  loadChainSecrets({
    CHAIN_EIP155_42220_RPC_URL: RPC,
    CHAIN_EIP155_42220_ESCROW_ADDR: EVM_ESCROW,
    CHAIN_EIP155_42220_TREASURY_ADDR: EVM_TREASURY,
  })

test('seeds only the active solana chain — IDL program id + configured treasury', () => {
  const rows = buildSeedRows(solDevnet({ CHAIN_SOLANA_DEVNET_USDC_MINT: MINT }))
  assert.deepStrictEqual(
    rows.chains.map((c) => c.id),
    ['solana:devnet'],
  )
  const c = rows.chains[0]
  assert.ok(c)
  assert.strictEqual(c.escrow_program, ESCROW_IDL.address)
  assert.strictEqual(c.treasury_address, SOL)
  assert.strictEqual(c.min_confirmations, 1)
  // Gas-seed pair stays unset until #40 (paired CHECK constraint).
  assert.strictEqual(c.gas_seed_amount_raw, undefined)
  assert.strictEqual(c.gas_seed_wallet_address, undefined)
})

test('native SOL + USDC bound to the active network from its secret mint', () => {
  const rows = buildSeedRows(solDevnet({ CHAIN_SOLANA_DEVNET_USDC_MINT: MINT }))
  const usdc = rows.assets.find((a) => a.id === 'USDC_SOL')
  assert.ok(usdc)
  assert.strictEqual(usdc.chain_id, 'solana:devnet')
  assert.strictEqual(usdc.token_address, MINT)
  assert.strictEqual(usdc.decimals, 6)
  assert.strictEqual(usdc.is_stable, true)
  const native = rows.assets.find((a) => a.token_address === null)
  assert.ok(native && native.id === 'SOL_DEVNET' && native.decimals === 9)
  assert.strictEqual(rows.skipped.length, 0)
})

test('missing USDC mint → USDC_SOL skipped with a named warning, never silent', () => {
  const rows = buildSeedRows(solDevnet())
  assert.strictEqual(
    rows.assets.some((a) => a.id === 'USDC_SOL'),
    false,
  )
  assert.strictEqual(rows.skipped.length, 1)
  assert.match(rows.skipped[0] ?? '', /USDC_SOL/)
})

test('BASE: chain + manifest USDC + native ETH, treasury/escrow from secrets', () => {
  const rows = buildSeedRows(baseMainnet())
  const base = rows.chains.find((c) => c.id === 'eip155:8453')
  assert.ok(base)
  assert.strictEqual(base.escrow_program, EVM_ESCROW)
  assert.strictEqual(base.treasury_address, EVM_TREASURY)
  assert.strictEqual(base.min_confirmations, 5)
  const usdc = rows.assets.find((a) => a.id === 'USDC_BASE')
  assert.ok(usdc)
  assert.strictEqual(usdc.token_address, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
  assert.ok(usdc.decimals === 6 && usdc.is_stable === true)
  const eth = rows.assets.find((a) => a.id === 'ETH_BASE')
  assert.ok(eth && eth.token_address === null && eth.decimals === 18)
})

test('CELO: manifest token constants + feeCurrency cUSD, native CELO', () => {
  const rows = buildSeedRows(celoMainnet())
  const celo = rows.chains.find((c) => c.id === 'eip155:42220')
  assert.ok(celo && celo.min_confirmations === 3)
  const ids = rows.assets.map((a) => a.id)
  assert.ok(ids.includes('cUSD') && ids.includes('USDC_CELO') && ids.includes('CELO'))
  const cusd = rows.assets.find((a) => a.id === 'cUSD')
  assert.ok(cusd)
  assert.strictEqual(cusd.token_address, '0x765DE816845861e75A25fCA122bb6898B8B1282a')
  assert.strictEqual(cusd.decimals, 18)
  const native = rows.assets.find((a) => a.id === 'CELO')
  assert.ok(native && native.token_address === null && native.is_stable === false)
})

test('different-family chains seed together', () => {
  const rows = buildSeedRows(
    loadChainSecrets({
      CHAIN_SOLANA_DEVNET_RPC_URL: RPC,
      CHAIN_SOLANA_DEVNET_TREASURY_ADDR: SOL,
      CHAIN_SOLANA_DEVNET_USDC_MINT: MINT,
      CHAIN_EIP155_8453_RPC_URL: RPC,
      CHAIN_EIP155_8453_ESCROW_ADDR: EVM_ESCROW,
      CHAIN_EIP155_8453_TREASURY_ADDR: EVM_TREASURY,
    }),
  )
  assert.deepStrictEqual(rows.chains.map((c) => c.id).sort(), ['eip155:8453', 'solana:devnet'])
})

test('fiat providers are always seeded', () => {
  assert.ok(buildSeedRows(solDevnet()).fiat_providers.length >= 1)
})
