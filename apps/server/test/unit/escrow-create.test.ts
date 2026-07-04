/**
 * lib/escrow-create — POST /v1/escrows validation layer.
 * Positive path + every rejection branch, including the
 * server-generated-id exit criterion.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { AppError } from '@server/lib/errors'
import {
  validateCreateEscrow,
  type CreateEscrowBody,
  type ValidateCreateDeps,
} from '@server/lib/escrow-create'

const NOW = new Date('2026-06-04T12:00:00Z')
const NOW_UNIX = Math.floor(NOW.getTime() / 1000)

function deps(over: Partial<ValidateCreateDeps> = {}): ValidateCreateDeps {
  return {
    hasChain: (chain_id) => chain_id === 'solana:devnet',
    now: () => NOW,
    caller_user_id: 'user-1',
    ...over,
  }
}

function body(over: Partial<CreateEscrowBody> = {}): CreateEscrowBody {
  return {
    kind: 'exchange',
    chain_id: 'solana:devnet',
    asset: 'SOL',
    amount_raw: '1000000000',
    accept_deadline_unix: NOW_UNIX + 3_600,
    completion_duration_seconds: 7_200,
    ...over,
  }
}

function expectRejects(b: CreateEscrowBody, status: number, pattern: RegExp): void {
  try {
    validateCreateEscrow(deps(), b)
  } catch (e) {
    assert.ok(e instanceof AppError, 'expected AppError')
    assert.strictEqual(e.statusCode, status)
    assert.match(e.message, pattern)
    return
  }
  assert.fail(`expected rejection matching ${pattern}`)
}

test('valid exchange body normalizes (bond defaults to 0, no assignment)', () => {
  const v = validateCreateEscrow(deps(), body())
  assert.deepStrictEqual(v, {
    kind: 'exchange',
    chain_id: 'solana:devnet',
    asset: 'SOL',
    amount_raw: '1000000000',
    accept_deadline_unix: NOW_UNIX + 3_600,
    completion_duration_seconds: 7_200,
    dispute_bond_raw: '0',
    assigned_counterparty_id: null,
    permit: null,
  })
})

test('permit: a valid body passes through typed; field violations are 422s', () => {
  const sig = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b`
  const permit = { value_raw: '1000000000', deadline_unix: NOW_UNIX + 600, signature: sig }
  const v = validateCreateEscrow(deps(), body({ permit }))
  assert.deepStrictEqual(v.permit, permit)

  // signed value below the escrow amount
  expectRejects(body({ permit: { ...permit, value_raw: '1' } }), 422, /below the transfer amount/)
  // deadline already passed
  expectRejects(body({ permit: { ...permit, deadline_unix: NOW_UNIX } }), 422, /already passed/)
  // malformed signature
  expectRejects(body({ permit: { ...permit, signature: '0xdead' } }), 422, /65-byte/)
  // wrong shapes
  expectRejects(body({ permit: 'yes' }), 422, /must be an object/)
  expectRejects(body({ permit: { value_raw: 5 } }), 422, /value_raw must be a string/)
})

test('assigned counterparty + explicit bond pass through', () => {
  const v = validateCreateEscrow(
    deps(),
    body({ assigned_counterparty_id: 'user-2', dispute_bond_raw: '5000' }),
  )
  assert.strictEqual(v.assigned_counterparty_id, 'user-2')
  assert.strictEqual(v.dispute_bond_raw, '5000')
})

test('client-supplied id → 400 (server-generated ids only)', () => {
  expectRejects(body({ id: 'attacker-chosen' }), 400, /server-generated/)
})

test('bad kind / missing chain / unregistered chain reject', () => {
  expectRejects(body({ kind: 'loan' }), 422, /kind/)
  expectRejects(body({ chain_id: '' }), 422, /chain_id/)
  expectRejects(body({ chain_id: 'eip155:8453' }), 422, /unsupported chain_id/)
})

test('gig asset rules enforced via assertGigAsset', () => {
  // SOL is not a USDC asset — gigs must reject it.
  assert.throws(() => validateCreateEscrow(deps(), body({ kind: 'gig', asset: 'SOL' })), AppError)
})

test('amount validation: non-canonical, zero', () => {
  expectRejects(body({ amount_raw: '1.5' }), 422, /amount_raw/)
  expectRejects(body({ amount_raw: 12 as unknown as string }), 422, /amount_raw/)
  expectRejects(body({ amount_raw: '0' }), 422, /positive/)
})

test('dispute bond must be canonical when supplied', () => {
  expectRejects(body({ dispute_bond_raw: '-3' }), 422, /dispute_bond_raw/)
})

test('deadline must be a future integer', () => {
  expectRejects(body({ accept_deadline_unix: NOW_UNIX }), 422, /future/)
  expectRejects(body({ accept_deadline_unix: 1.5 }), 422, /integer/)
  expectRejects(body({ accept_deadline_unix: 'tomorrow' as unknown as number }), 422, /integer/)
})

test('completion duration must be a positive integer', () => {
  expectRejects(body({ completion_duration_seconds: 0 }), 422, /positive/)
  expectRejects(body({ completion_duration_seconds: -10 }), 422, /positive/)
})

test('self-assignment rejected', () => {
  expectRejects(body({ assigned_counterparty_id: 'user-1' }), 422, /cannot be the creator/)
})

test('amount_raw at the numeric(78,0) precision boundary: 78 digits ok, 79 rejected', () => {
  // ADVERSARIAL: an over-precision amount must fail validation (422) rather
  // than overflow the numeric(78,0) column at insert time (postgres 500).
  const at = '9'.repeat(78)
  const over = '9'.repeat(79)
  assert.strictEqual(validateCreateEscrow(deps(), body({ amount_raw: at })).amount_raw, at)
  expectRejects(body({ amount_raw: over }), 422, /amount_raw exceeds the maximum precision/)
})

test('dispute_bond_raw is bounded by the same precision', () => {
  expectRejects(body({ dispute_bond_raw: '9'.repeat(79) }), 422, /dispute_bond_raw exceeds the maximum precision/)
})
