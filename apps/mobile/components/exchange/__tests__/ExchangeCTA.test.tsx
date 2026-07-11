/**
 * ExchangeCTA — the buyer (counterparty) must keep an add-evidence affordance
 * while a dispute is open (the bug: it fell through to null, mirroring the gig
 * path's earlier fix). canAddProof = counterparty + submitted|disputed, so the
 * same branch also covers add-more-proof while the seller reviews.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { ExchangeDetail, EscrowStatus, UserRef } from '@tenda/shared'

jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  }
})

import { ExchangeCTA } from '../ExchangeCTA'

const SELLER = 'seller-id'
const BUYER = 'buyer-id'

function user(id: string): UserRef {
  return { id, first_name: 'A', last_name: 'B', avatar_url: null, review_score: '0', is_seeker: false, country: 'NG' }
}

function offer(status: EscrowStatus, withCounterparty = true): ExchangeDetail {
  return {
    escrow_id: 'e1', chain_id: 'solana:devnet', asset: 'USDC_SOL', amount_raw: '100000000',
    status, fiat_amount: '160000', fiat_currency: 'NGN', rate: '1600', payment_window_seconds: 43_200,
    accept_deadline: null, created_at: '2026-07-01T00:00:00.000Z', creator: user(SELLER), payment_proof_url: null,
    dispute_bond_raw: '0', completion_deadline: null, submitted_at: null, approval_deadline: null,
    counterparty: withCounterparty ? user(BUYER) : null, proofs: [], dispute: null, reviews: [], payout_account: null,
  }
}

const noop = () => {}
const baseProps = { busy: false, onTxAction: noop }

test('disputed buyer gets an "Add Evidence" button that opens the add-proof sheet', () => {
  const onSheet = jest.fn()
  render(<ExchangeCTA offer={offer('disputed')} userId={BUYER} onSheet={onSheet} {...baseProps} />)

  const btn = screen.getByText('Add Evidence')
  fireEvent.press(btn)
  expect(onSheet).toHaveBeenCalledWith('addProof')
})

test('submitted buyer gets "Add More Proof" (same branch, non-dispute wording)', () => {
  const onSheet = jest.fn()
  render(<ExchangeCTA offer={offer('submitted')} userId={BUYER} onSheet={onSheet} {...baseProps} />)

  fireEvent.press(screen.getByText('Add More Proof'))
  expect(onSheet).toHaveBeenCalledWith('addProof')
})

test('disputed seller (creator) sees no evidence button — evidence is the counterparty’s', () => {
  render(<ExchangeCTA offer={offer('disputed')} userId={SELLER} onSheet={noop} {...baseProps} />)
  expect(screen.queryByText('Add Evidence')).toBeNull()
  expect(screen.queryByText('Add More Proof')).toBeNull()
})

test('submitted seller still gets Confirm & Release (branch not shadowed by canAddProof)', () => {
  render(<ExchangeCTA offer={offer('submitted')} userId={SELLER} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Confirm & Release')).toBeTruthy()
})
