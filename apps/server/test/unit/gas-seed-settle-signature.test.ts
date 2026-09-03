/**
 * `settleSignature` — the guard between "confirmation failed" and "no money
 * moved", which are not the same thing.
 *
 * MEASURED ON DEVNET, which is why this file exists: the Solana seed sender
 * threw "Signature … has expired: block height exceeded" after 20,698ms while
 * the recipient held the full 7,000,000 lamports. `dispatchGasSeeds` reads a
 * throw from `send()` as "the transfer did not happen" and RELEASES the claimed
 * slot, so that user was paid and still claimable — one grant per attempt, out
 * of the hot wallet. The root cause was a provider whose HTTP key does not
 * authorise WebSockets, so the confirmation subscription 401'd and confirmation
 * degraded to blockhash-expiry polling.
 *
 * Every case below is about which way the ambiguity is resolved.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { settleSignature, signatureDelivered } from '@server/features/gas-seed/senders/solana'

const SIG = '3dzGsZL1zD6dZLRiq8B7T4wi8NkRy2MCzpENJhYYkEh4F2ehdoM6KUb1TgnmCvqN27sV1nXHYvENmeywmKLFU6pq'

test('a clean confirmation returns the signature and never asks the chain', async () => {
  let asked = 0
  const got = await settleSignature({
    signature: SIG,
    confirm: async () => undefined,
    landed: async () => { asked += 1; return true },
  })
  assert.strictEqual(got, SIG)
  assert.strictEqual(asked, 0, 'the status check costs a round trip; do not pay it when confirmation worked')
})

test('confirmation FAILED but the transfer LANDED: success, not a throw', async () => {
  // The drain, in one assertion. A throw here frees the claimed slot and the
  // user — already paid — can claim again.
  const got = await settleSignature({
    signature: SIG,
    confirm: async () => { throw new Error('Signature has expired: block height exceeded') },
    landed: async () => true,
  })
  assert.strictEqual(got, SIG, 'a landed transfer must be reported as delivered')
})

test('confirmation failed and the transfer did NOT land: the ORIGINAL error propagates', async () => {
  // The honest failure, and the caller depends on it: releasing the slot is
  // correct here, so this must still throw — and with the confirmation error,
  // not something invented by the status check.
  const boom = new Error('blockhash not found')
  await assert.rejects(
    () => settleSignature({ signature: SIG, confirm: async () => { throw boom }, landed: async () => false }),
    (err: unknown) => {
      assert.strictEqual(err, boom, 'the very error the chain gave us')
      return true
    },
  )
})

// ---------- what a status actually MEANS ------------------------------------

test('signatureDelivered: only a landed transaction with no error is a delivered seed', () => {
  // Three distinct chain answers, and the middle one is the whole point. This
  // replaced a test that CLAIMED to cover the reverted case while passing
  // `landed: false` — byte-identical input to the test above it, so it moved
  // with that test under every mutation and pinned nothing about reverts. The
  // rule lived inside the web3 closure, unreachable from any suite.
  assert.strictEqual(signatureDelivered(null), false, 'never seen by the cluster')
  assert.strictEqual(signatureDelivered({ err: null }), true, 'landed and succeeded')
  assert.strictEqual(
    signatureDelivered({ err: { InstructionError: [0, 'Custom'] } }),
    false,
    'on chain but FAILED — the lamports never moved, so this is not a delivered seed',
  )
})

test('an INCONCLUSIVE status check keeps the claim rather than risking a second payment', async () => {
  // We cannot tell whether the money moved. The two mistakes are not equal: a
  // false success strands a grant row that `verify:gas-seed` reports and an
  // operator repairs, while a false failure pays twice. ../dispatch makes the
  // same trade one step later.
  const got = await settleSignature({
    signature: SIG,
    confirm: async () => { throw new Error('confirmation timed out') },
    landed: async () => { throw new Error('rpc unreachable') },
  })
  assert.strictEqual(got, SIG)
})

