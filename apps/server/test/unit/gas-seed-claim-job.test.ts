/**
 * The transfer half of a claim (#53c-1): every way it can end, and which of
 * those endings releases the slot.
 *
 * The release decision is the whole point of this file. Releasing a slot whose
 * transfer FAILED costs a retry; releasing one whose transfer SUCCEEDED costs a
 * second payment out of the hot wallet. They are one `catch` apart, and no
 * behavioural test above this layer would notice them being swapped.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  handleGasSeedClaim,
  pendingTxRef,
  type GasSeedGrantedNotice,
  type GasSeedJobDeps,
  type GasSeedSender,
} from '@server/features/gas-seed'

const CHAIN = 'eip155:16661'
const USER = 'u-1'
const AMOUNT = '10000000000000000'

interface StoredGrant {
  tx_ref: string
  amount_raw: string
  wallet_address: string | null
}

function makeDeps(opts: {
  grant?: StoredGrant | null
  senderFails?: boolean
  finalizeFails?: boolean
  noSender?: boolean
}) {
  const released: string[] = []
  const finalized: Array<{ chain_id: string; tx_ref: string }> = []
  const notices: GasSeedGrantedNotice[] = []
  const transfers: Array<{ to_address: string; amount_raw: string }> = []

  const sender: GasSeedSender = {
    async send({ to_address, amount_raw }) {
      if (opts.senderFails ?? false) throw new Error('rpc down')
      transfers.push({ to_address, amount_raw })
      return { tx_ref: '0xrealhash' }
    },
  }

  const deps: GasSeedJobDeps = {
    seed: {
      async finalizeGrant(_user_id, chain_id, tx_ref) {
        if (opts.finalizeFails ?? false) throw new Error('connection terminated')
        finalized.push({ chain_id, tx_ref })
      },
      async releaseGrant(_user_id, chain_id) {
        released.push(chain_id)
      },
    },
    claim: {
      async findClaimedGrant() {
        return opts.grant === undefined
          ? { tx_ref: pendingTxRef(USER, CHAIN), amount_raw: AMOUNT, wallet_address: '0xEvm' }
          : opts.grant
      },
    },
    senders: (opts.noSender ?? false) ? new Map() : new Map([[CHAIN, sender]]),
    async notify(notice) {
      notices.push(notice)
    },
    log: { info() {}, warn() {} },
  }
  return { deps, released, finalized, notices, transfers }
}

test('the happy path pays the claimed wallet, stamps the real hash, then notifies', async () => {
  const { deps, finalized, notices, transfers, released } = makeDeps({})
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'granted')
  assert.deepStrictEqual(transfers, [{ to_address: '0xEvm', amount_raw: AMOUNT }])
  assert.deepStrictEqual(finalized, [{ chain_id: CHAIN, tx_ref: '0xrealhash' }])
  assert.deepStrictEqual(released, [], 'a successful grant released its slot')
  assert.deepStrictEqual(notices, [
    { user_id: USER, chain_id: CHAIN, amount_raw: AMOUNT, tx_ref: '0xrealhash' },
  ])
})

test('it pays what the ROW recorded, not what config says now', async () => {
  // The row is the record of what the user was promised. Re-deriving the amount
  // from the chain at send time would pay a different number than the claim
  // showed them if an operator re-seeded in between.
  const { deps, transfers } = makeDeps({
    grant: { tx_ref: pendingTxRef(USER, CHAIN), amount_raw: '777', wallet_address: '0xOther' },
  })
  await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })
  assert.deepStrictEqual(transfers, [{ to_address: '0xOther', amount_raw: '777' }])
})

test('a transfer failure RELEASES the slot so the user can claim again', async () => {
  const { deps, released, finalized, notices } = makeDeps({ senderFails: true })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'transfer-failed')
  assert.deepStrictEqual(released, [CHAIN])
  assert.deepStrictEqual(finalized, [])
  assert.deepStrictEqual(notices, [], 'told the user about a transfer that never happened')
})

test('a transfer that LANDS but cannot be stamped keeps the slot — never pays twice', async () => {
  // The asymmetry this file exists for. The money has left the hot wallet;
  // releasing here would let the next claim pay the same user a second time.
  // The `pending:` row that survives is exactly what verify-gas-seed reports.
  const { deps, released, notices } = makeDeps({ finalizeFails: true })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'granted-not-recorded')
  assert.deepStrictEqual(released, [], 'released a slot whose money had already left')
  assert.deepStrictEqual(notices, [], 'announced a grant the database does not record')
})

test('a job whose claim was already released does nothing at all', async () => {
  const { deps, released, finalized, transfers } = makeDeps({ grant: null })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'no-claim')
  assert.deepStrictEqual(transfers, [], 'paid a claim that no longer exists')
  assert.deepStrictEqual(released, [])
  assert.deepStrictEqual(finalized, [])
})

test('a REDELIVERED job for a finished grant does not pay again', async () => {
  // BullMQ can redeliver, and the payload carries no proof of what already
  // happened. The finished tx_ref is that proof.
  const { deps, transfers } = makeDeps({
    grant: { tx_ref: '0xalreadydone', amount_raw: AMOUNT, wallet_address: '0xEvm' },
  })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'already-finalized')
  assert.deepStrictEqual(transfers, [], 'paid a grant that had already landed')
})

test('a claim whose wallet vanished releases rather than paying nowhere', async () => {
  const { deps, released, transfers } = makeDeps({
    grant: { tx_ref: pendingTxRef(USER, CHAIN), amount_raw: AMOUNT, wallet_address: null },
  })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'no-wallet')
  assert.deepStrictEqual(released, [CHAIN])
  assert.deepStrictEqual(transfers, [])
})

test('a chain whose key was pulled between claim and delivery releases the slot', async () => {
  // Otherwise the claim is stuck `in_progress` forever: no sender will ever
  // exist for it, and the user cannot claim again.
  const { deps, released } = makeDeps({ noSender: true })
  const outcome = await handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN })

  assert.strictEqual(outcome, 'sender-missing')
  assert.deepStrictEqual(released, [CHAIN])
})

test('the handler never throws, so BullMQ does not retry work already undone', async () => {
  // Throwing would hand the job back for four more attempts, each finding the
  // slot released and doing nothing — four `failed` log lines saying nothing.
  for (const opts of [{ senderFails: true }, { finalizeFails: true }, { noSender: true }]) {
    const { deps } = makeDeps(opts)
    await assert.doesNotReject(() => handleGasSeedClaim(deps, { user_id: USER, chain_id: CHAIN }))
  }
})
