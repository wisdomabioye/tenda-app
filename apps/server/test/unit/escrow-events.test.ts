/**
 * lib/escrow-events — the event→DB application table. Every event maps to
 * its status guard, tx type, derived columns and actor; replays absorb via
 * the guard.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  EVENT_APPLICATIONS,
  INTERNAL_EVENT_BY_WIRE,
  applyEscrowEvent,
  type ApplyEscrowEventDeps,
  type EscrowEventStore,
  type EscrowPatch,
} from '@server/lib/escrow-events'
import { ESCROW_EVENTS, type DecodedEvent, type EscrowEvent } from '@server/chains/types'
import type { EscrowStatus } from '@server/lib/escrow'

const ESCROW_ID = '11111111-2222-4333-8444-555555555555'
const TX_REF = 'sig-1'

interface Recorded {
  transitions: Array<{ escrow_id: string; from: EscrowStatus[]; patch: EscrowPatch }>
  transactions: Array<{
    escrow_id: string
    type: string
    tx_ref: string
    amount_raw: string | null
    platform_fee_raw: string | null
    actor_id: string | null
  }>
  resolutions: Array<{ escrow_id: string; winner: string }>
}

function makeDeps(opts: { guardTrips?: boolean; wallets?: Record<string, string> } = {}): {
  deps: ApplyEscrowEventDeps
  rec: Recorded
} {
  const rec: Recorded = { transitions: [], transactions: [], resolutions: [] }
  const store: EscrowEventStore = {
    async applyTransition(args) {
      rec.transitions.push(args)
      return !(opts.guardTrips ?? false)
    },
    async insertTransaction(row) {
      rec.transactions.push(row)
    },
    async resolveUserByWallet(_ns, address) {
      return opts.wallets?.[address] ?? null
    },
    async recordDisputeResolution(args) {
      rec.resolutions.push(args)
    },
  }
  return { deps: { store, chain_ns: 'solana' }, rec }
}

function event(name: EscrowEvent, fields: Record<string, string>): DecodedEvent {
  return { name, escrow_ref: 'EscrowPda111', fields: { escrow_id: ESCROW_ID, ...fields } }
}

test('table covers every wire event with an internal name', () => {
  for (const name of ESCROW_EVENTS) {
    assert.ok(EVENT_APPLICATIONS[name], `missing application for ${name}`)
    assert.ok(INTERNAL_EVENT_BY_WIRE[name].startsWith('escrow.'))
  }
})

test('EscrowCreated: draft→open, stamps escrow_ref, records create with amount + creator actor', async () => {
  const { deps, rec } = makeDeps({ wallets: { Creator111: 'user-creator' } })
  const r = await applyEscrowEvent(
    deps,
    event('EscrowCreated', { amount: '1000', creator: 'Creator111' }),
    TX_REF,
  )
  assert.deepStrictEqual(r, {
    applied: true,
    escrow_id: ESCROW_ID,
    internal_event: 'escrow.created',
  })
  assert.deepStrictEqual(rec.transitions[0].from, ['draft'])
  assert.strictEqual(rec.transitions[0].patch.status, 'open')
  assert.strictEqual(rec.transitions[0].patch.escrow_ref, 'EscrowPda111')
  assert.deepStrictEqual(rec.transactions[0], {
    escrow_id: ESCROW_ID,
    type: 'create',
    tx_ref: TX_REF,
    amount_raw: '1000',
    platform_fee_raw: null,
    actor_id: 'user-creator',
  })
})

test('EscrowAccepted: open→accepted, resolves counterparty wallet, sets completion_deadline', async () => {
  const { deps, rec } = makeDeps({ wallets: { Cp111: 'user-cp' } })
  await applyEscrowEvent(
    deps,
    event('EscrowAccepted', { counterparty: 'Cp111', completion_deadline: '1900007200' }),
    TX_REF,
  )
  const patch = rec.transitions[0].patch
  assert.strictEqual(patch.status, 'accepted')
  assert.strictEqual(patch.counterparty_id, 'user-cp')
  assert.strictEqual(patch.completion_deadline?.getTime(), 1_900_007_200_000)
})

test('EscrowDeclined: status stays (no status in patch), assignment cleared', async () => {
  const { deps, rec } = makeDeps()
  await applyEscrowEvent(deps, event('EscrowDeclined', { declined_by: 'X' }), TX_REF)
  assert.strictEqual(rec.transitions[0].patch.status, undefined)
  assert.strictEqual(rec.transitions[0].patch.assigned_counterparty_id, null)
})

test('ProofSubmitted: accepted→submitted with submitted_at + approval_deadline', async () => {
  const { deps, rec } = makeDeps()
  await applyEscrowEvent(
    deps,
    event('ProofSubmitted', {
      counterparty: 'Cp111',
      approval_deadline: '1900180000',
      timestamp: '1900007000',
    }),
    TX_REF,
  )
  const patch = rec.transitions[0].patch
  assert.strictEqual(patch.status, 'submitted')
  assert.strictEqual(patch.submitted_at?.getTime(), 1_900_007_000_000)
  assert.strictEqual(patch.approval_deadline?.getTime(), 1_900_180_000_000)
})

test('settlement events record amount + fee; DisputeRaised guards both prior statuses', async () => {
  const { deps, rec } = makeDeps()
  await applyEscrowEvent(
    deps,
    event('EscrowApproved', { amount: '975', platform_fee: '25', creator: 'C' }),
    'sig-a',
  )
  assert.strictEqual(rec.transactions[0].amount_raw, '975')
  assert.strictEqual(rec.transactions[0].platform_fee_raw, '25')

  await applyEscrowEvent(
    deps,
    event('DisputeRaised', { bond_amount: '100', raised_by: 'R', from_status: 'accepted' }),
    'sig-b',
  )
  assert.deepStrictEqual(rec.transitions[1].from, ['accepted', 'submitted'])
  assert.strictEqual(rec.transactions[1].amount_raw, '100')
})

test('DisputeResolved: disputed→resolved + dispute row stamped with the winner', async () => {
  const { deps, rec } = makeDeps()
  await applyEscrowEvent(
    deps,
    event('DisputeResolved', {
      winner: 'split',
      creator_payout: '500',
      counterparty_payout: '501',
      platform_fee: '0',
    }),
    TX_REF,
  )
  assert.deepStrictEqual(rec.resolutions, [{ escrow_id: ESCROW_ID, winner: 'split' }])
})

test('status-guard trip: no transaction row, no resolution, applied:false', async () => {
  const { deps, rec } = makeDeps({ guardTrips: true })
  const r = await applyEscrowEvent(
    deps,
    event('EscrowApproved', { amount: '975', platform_fee: '25', creator: 'C' }),
    TX_REF,
  )
  assert.strictEqual(r.applied, false)
  assert.strictEqual(rec.transactions.length, 0)
})

test('unknown actor wallet → actor_id null (event still applies)', async () => {
  const { deps, rec } = makeDeps({ wallets: {} })
  await applyEscrowEvent(
    deps,
    event('EscrowCancelled', { refund_amount: '1000', creator: 'Unknown111' }),
    TX_REF,
  )
  assert.strictEqual(rec.transactions[0].actor_id, null)
})

test('missing escrow_id in decoded fields throws (decoder bug, not data)', async () => {
  const { deps } = makeDeps()
  await assert.rejects(
    applyEscrowEvent(
      deps,
      { name: 'EscrowCreated', escrow_ref: 'X', fields: {} },
      TX_REF,
    ),
    /missing escrow_id/,
  )
})
