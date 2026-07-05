import { ESCROW_TX_TYPES, type EscrowTxType } from '@tenda/shared'
import {
  TX_PROGRESS_LABEL,
  WALLET_OPEN_NOTE,
  isGatedTxAction,
  txConfirmCopy,
  type TxConfirmContext,
} from '../copy'

const GIG: TxConfirmContext = { amount: '50 USDC', kind: 'gig' }
const EXCHANGE: TxConfirmContext = { amount: '50 USDC', kind: 'exchange' }

describe('TX_PROGRESS_LABEL', () => {
  it('covers every escrow tx type (no blank progress heading can slip through)', () => {
    for (const type of ESCROW_TX_TYPES) {
      expect(TX_PROGRESS_LABEL[type]).toBeTruthy()
    }
    // Total, not a superset: keys match the shared vocabulary exactly.
    expect(Object.keys(TX_PROGRESS_LABEL).sort()).toEqual([...ESCROW_TX_TYPES].sort())
  })
})

describe('isGatedTxAction', () => {
  it('gates the wallet-opening transitions', () => {
    const gated: EscrowTxType[] = [
      'create',
      'accept',
      'approve',
      'claim_stalled',
      'cancel',
      'refund_expired',
      'reclaim_abandoned',
    ]
    for (const a of gated) expect(isGatedTxAction(a)).toBe(true)
  })

  it('does not gate input-sheet or admin actions', () => {
    const ungated: EscrowTxType[] = ['submit', 'dispute', 'decline', 'resolve']
    for (const a of ungated) expect(isGatedTxAction(a)).toBe(false)
  })
})

describe('txConfirmCopy — gated actions', () => {
  it('returns null for ungated actions', () => {
    expect(txConfirmCopy('submit', GIG)).toBeNull()
    expect(txConfirmCopy('dispute', GIG)).toBeNull()
    expect(txConfirmCopy('decline', GIG)).toBeNull()
    expect(txConfirmCopy('resolve', GIG)).toBeNull()
  })

  it('every gated action gets a non-empty title, label and the wallet note', () => {
    const gated: EscrowTxType[] = [
      'create',
      'accept',
      'approve',
      'claim_stalled',
      'cancel',
      'refund_expired',
      'reclaim_abandoned',
    ]
    for (const a of gated) {
      const copy = txConfirmCopy(a, GIG)
      expect(copy).not.toBeNull()
      expect(copy?.title).toBeTruthy()
      expect(copy?.confirmLabel).toBeTruthy()
      expect(copy?.body).toContain(WALLET_OPEN_NOTE)
    }
  })

  it('surfaces the amount in value-moving actions', () => {
    for (const a of ['create', 'approve', 'claim_stalled', 'cancel', 'refund_expired', 'reclaim_abandoned'] as const) {
      expect(txConfirmCopy(a, GIG)?.body).toContain('50 USDC')
    }
  })

  it('marks cancel as destructive and approve as non-destructive', () => {
    expect(txConfirmCopy('cancel', GIG)?.destructive).toBe(true)
    expect(txConfirmCopy('approve', GIG)?.destructive).toBe(false)
  })

  it('uses gig vs exchange wording and labels', () => {
    expect(txConfirmCopy('create', GIG)?.confirmLabel).toBe('Fund Gig')
    expect(txConfirmCopy('create', EXCHANGE)?.confirmLabel).toBe('Publish Offer')
    expect(txConfirmCopy('approve', GIG)?.confirmLabel).toBe('Approve & Pay')
    expect(txConfirmCopy('approve', EXCHANGE)?.confirmLabel).toBe('Confirm & Release')
    expect(txConfirmCopy('approve', GIG)?.body).toContain('worker')
    expect(txConfirmCopy('approve', EXCHANGE)?.body).toContain('buyer')
    expect(txConfirmCopy('claim_stalled', GIG)?.confirmLabel).toBe('Claim Payment')
    expect(txConfirmCopy('claim_stalled', EXCHANGE)?.confirmLabel).toBe('Claim Crypto')
    expect(txConfirmCopy('cancel', GIG)?.confirmLabel).toBe('Cancel Gig')
    expect(txConfirmCopy('cancel', EXCHANGE)?.confirmLabel).toBe('Cancel Offer')
  })

  it('names the concrete deliver-within window for gig accept, falls back otherwise', () => {
    expect(txConfirmCopy('accept', { ...GIG, deliverWithin: '2 days' })?.body).toContain('2 days')
    // null / empty → generic window copy, still valid
    expect(txConfirmCopy('accept', { ...GIG, deliverWithin: null })?.body).toContain('agreed time window')
    expect(txConfirmCopy('accept', { ...GIG, deliverWithin: '' })?.body).toContain('agreed time window')
  })
})
