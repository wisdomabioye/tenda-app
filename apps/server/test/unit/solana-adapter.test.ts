/**
 * chains/solana adapter — Stage 0 surface.
 *
 * Live-tested: verifyAuthSig (round-trip Ed25519), computeFee delegation,
 * factory shape. Stubbed methods asserted to fail with 501.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { AppError } from '@server/lib/errors'
import { solanaAdapter, verifyEd25519 } from '@server/chains/solana'

const ARGS = {
  chain_id: 'solana:devnet',
  rpc_url: 'https://api.devnet.solana.com',
  program_id: 'Tenda111111111111111111111111111111111111111',
}

function makeKeypair(): { address: string; secret: Uint8Array } {
  const kp = nacl.sign.keyPair()
  return { address: bs58.encode(kp.publicKey), secret: kp.secretKey }
}

function sign(secret: Uint8Array, message: string): string {
  const msg = new TextEncoder().encode(message)
  return Buffer.from(nacl.sign.detached(msg, secret)).toString('base64')
}

async function expectNotImplemented(p: Promise<unknown>, method: string): Promise<void> {
  await p.then(
    () => assert.fail(`expected ${method} to throw`),
    (err) => {
      if (!(err instanceof AppError)) throw err
      assert.strictEqual(err.statusCode, 501)
      assert.match(err.message, new RegExp(`solana\\.${method}`))
    },
  )
}

// ---------- factory ------------------------------------------------------

test('solanaAdapter: returns a fully-shaped ChainAdapter', () => {
  const a = solanaAdapter(ARGS)
  assert.strictEqual(a.namespace, 'solana')
  assert.strictEqual(a.chain_id, 'solana:devnet')
  assert.strictEqual(typeof a.buildTx, 'function')
  assert.strictEqual(typeof a.verifyTx, 'function')
  assert.strictEqual(typeof a.verifyAuthSig, 'function')
  assert.strictEqual(typeof a.fetchEscrowState, 'function')
  assert.strictEqual(typeof a.computeFee, 'function')
})

// ---------- verifyAuthSig (live) -----------------------------------------

test('verifyAuthSig: signed message round-trips → true', async () => {
  const { address, secret } = makeKeypair()
  const message = 'Tenda auth-message v1\nnonce=abc123\nchain=solana:devnet'
  const signature = sign(secret, message)
  const a = solanaAdapter(ARGS)
  const ok = await a.verifyAuthSig({ address, message, signature })
  assert.strictEqual(ok, true)
})

test('verifyAuthSig: tampered message → false', async () => {
  const { address, secret } = makeKeypair()
  const signature = sign(secret, 'original message')
  const a = solanaAdapter(ARGS)
  const ok = await a.verifyAuthSig({ address, message: 'tampered message', signature })
  assert.strictEqual(ok, false)
})

test('verifyAuthSig: wrong address → false', async () => {
  const { secret } = makeKeypair()
  const other = makeKeypair()
  const message = 'msg'
  const signature = sign(secret, message)
  const a = solanaAdapter(ARGS)
  const ok = await a.verifyAuthSig({ address: other.address, message, signature })
  assert.strictEqual(ok, false)
})

test('verifyAuthSig: malformed base58 address → false (no throw)', async () => {
  const a = solanaAdapter(ARGS)
  const ok = await a.verifyAuthSig({
    address: 'not-a-valid-pubkey!!!',
    message: 'msg',
    signature: Buffer.alloc(64).toString('base64'),
  })
  assert.strictEqual(ok, false)
})

test('verifyAuthSig: wrong signature length → false', async () => {
  const { address } = makeKeypair()
  const a = solanaAdapter(ARGS)
  const ok = await a.verifyAuthSig({
    address,
    message: 'msg',
    signature: Buffer.alloc(32).toString('base64'),
  })
  assert.strictEqual(ok, false)
})

test('verifyEd25519: matches adapter.verifyAuthSig (helper export)', () => {
  const { address, secret } = makeKeypair()
  const message = 'msg'
  const ok = verifyEd25519({
    address,
    message,
    signature_b64: sign(secret, message),
  })
  assert.strictEqual(ok, true)
})

// ---------- computeFee (delegates to lib/escrow) -------------------------

test('computeFee: 1000000 USDC raw * 250 bps = 25000', () => {
  const a = solanaAdapter(ARGS)
  const fee = a.computeFee({
    amount_raw: '1000000',
    is_seeker: false,
    fee_bps: 250,
    seeker_fee_bps: 100,
  })
  assert.strictEqual(fee, '25000')
})

test('computeFee: is_seeker=true uses seeker_fee_bps', () => {
  const a = solanaAdapter(ARGS)
  const fee = a.computeFee({
    amount_raw: '1000000',
    is_seeker: true,
    fee_bps: 250,
    seeker_fee_bps: 100,
  })
  assert.strictEqual(fee, '10000')
})

// ---------- stubs --------------------------------------------------------

test('buildTx: stub throws 501', async () => {
  const a = solanaAdapter(ARGS)
  await expectNotImplemented(
    a.buildTx({
      action: 'cancelEscrow',
      user_id: 'u1',
      payload: { escrow_id: 'e1' },
    }),
    'buildTx',
  )
})

test('verifyTx: stub throws 501', async () => {
  const a = solanaAdapter(ARGS)
  await expectNotImplemented(
    a.verifyTx('tx-sig', { expected_event: 'EscrowCreated' }),
    'verifyTx',
  )
})

test('fetchEscrowState: stub throws 501', async () => {
  const a = solanaAdapter(ARGS)
  await expectNotImplemented(a.fetchEscrowState('escrow-ref'), 'fetchEscrowState')
})
