/**
 * jobs/verify-tx — Stage 0 skeleton.
 * Step-1 dedup is implemented; steps 2-5 throw 501 until Stage 2.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { AppError } from '@server/lib/errors'
import {
  RetryableError,
  type VerifyTxDeps,
  type VerifyTxJobPayload,
  type VerifyTxStore,
  verifyTxDedupKey,
  verifyTxJobHandler,
} from '@server/jobs/verify-tx'
import { buildChainRegistry } from '@server/chains'
import type { Config } from '@server/config'

function inMemoryStore(initial: ReadonlyArray<string> = []): VerifyTxStore {
  const processed = new Set(initial)
  return {
    async isProcessed(tx_ref) {
      return processed.has(tx_ref)
    },
  }
}

function baseConfig(): Config {
  return {
    DATABASE_URL: 'postgres://localhost/test',
    JWT_SECRET: 's',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_TREASURY_ADDRESS: 'Treasury1111',
    SOLANA_PROGRAM_ID: 'Tenda11111111111111111111111111111111111',
    PLATFORM_FEE_BPS: 250,
    JWT_EXPIRES_IN: '7d',
    SOLANA_NETWORK: 'devnet',
    CORS_ORIGIN: null,
    ADMIN_ORIGIN: null,
  }
}

function deps(store: VerifyTxStore): VerifyTxDeps {
  return { store, chains: buildChainRegistry(baseConfig()) }
}

function job(over: Partial<VerifyTxJobPayload> = {}): VerifyTxJobPayload {
  return {
    chain_id: 'solana:devnet',
    tx_ref: 'sig-abc',
    expected_event: 'EscrowCreated',
    source: 'client-hint',
    ...over,
  }
}

// ---------- dedup key ----------------------------------------------------

test('verifyTxDedupKey: stable format `verify-tx:chain:tx_ref:event`', () => {
  const key = verifyTxDedupKey({
    chain_id: 'solana:devnet',
    tx_ref: '4xY...',
    event: 'EscrowCreated',
  })
  assert.strictEqual(key, 'verify-tx:solana:devnet:4xY...:EscrowCreated')
})

test('verifyTxDedupKey: different events → different keys', () => {
  const a = verifyTxDedupKey({ chain_id: 'c', tx_ref: 't', event: 'EscrowCreated' })
  const b = verifyTxDedupKey({ chain_id: 'c', tx_ref: 't', event: 'EscrowAccepted' })
  assert.notStrictEqual(a, b)
})

test('verifyTxDedupKey: identical inputs → identical keys', () => {
  const a = verifyTxDedupKey({ chain_id: 'c', tx_ref: 't', event: 'EscrowCreated' })
  const b = verifyTxDedupKey({ chain_id: 'c', tx_ref: 't', event: 'EscrowCreated' })
  assert.strictEqual(a, b)
})

// ---------- handler: dedup step ----------------------------------------

test('handler: returns skipped when tx_ref already processed', async () => {
  const result = await verifyTxJobHandler(deps(inMemoryStore(['sig-abc'])), job())
  assert.deepStrictEqual(result, { skipped: true, reason: 'already_processed' })
})

test('handler: dedup is exact (different tx_ref → not skipped)', async () => {
  try {
    await verifyTxJobHandler(deps(inMemoryStore(['other-sig'])), job())
    assert.fail('expected throw past dedup')
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    assert.strictEqual(err.statusCode, 501)
  }
})

// ---------- handler: post-dedup pipeline stubbed -----------------------

test('handler: fresh tx_ref → throws 501 (stages 2-5 deferred)', async () => {
  try {
    await verifyTxJobHandler(deps(inMemoryStore()), job())
    assert.fail('expected throw')
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    assert.strictEqual(err.statusCode, 501)
    assert.match(err.message, /post-dedup pipeline not implemented/)
  }
})

test('handler: rejects unknown chain_id (registry guard fires past dedup)', async () => {
  // Explicit empty store + distinct tx_ref so dedup CANNOT short-circuit;
  // any throw must come from the registry lookup at step 2.
  const emptyStore = inMemoryStore()
  try {
    await verifyTxJobHandler(
      deps(emptyStore),
      job({ chain_id: 'eip155:8453', tx_ref: 'never-seen-tx-ref' }),
    )
    assert.fail('expected throw')
  } catch (err) {
    if (!(err instanceof Error)) throw err
    assert.match(err.message, /no adapter registered.*eip155:8453/)
  }
})

// ---------- RetryableError shape ---------------------------------------

test('RetryableError: distinct from AppError, carries reason', () => {
  const err = new RetryableError('not_yet_confirmed')
  assert.strictEqual(err.name, 'RetryableError')
  assert.strictEqual(err.message, 'not_yet_confirmed')
  assert.ok(err instanceof Error)
  assert.ok(!(err instanceof AppError))
})
