/**
 * ExchangeCTA — the buyer (counterparty) must keep an add-evidence affordance
 * while a dispute is open (the bug: it fell through to null, mirroring the gig
 * path's earlier fix). canAddProof = counterparty + submitted|disputed, so the
 * same branch also covers add-more-proof while the seller reviews.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { ExchangeDetail } from '@tenda/shared'
import {
  BUYER_ID,
  SELLER_ID,
  STRANGER_ID,
  exchangeDetail,
  matchedOffer,
} from '../__fixtures__/exchange-detail'

jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  }
})

import { ExchangeCTA } from '../ExchangeCTA'

const noop = () => {}
const baseProps = { busy: false, onTxAction: noop }

test('disputed buyer gets an "Add Evidence" button that opens the add-proof sheet', () => {
  const onSheet = jest.fn()
  render(<ExchangeCTA offer={matchedOffer('disputed')} userId={BUYER_ID} onSheet={onSheet} {...baseProps} />)

  const btn = screen.getByText('Add Evidence')
  fireEvent.press(btn)
  expect(onSheet).toHaveBeenCalledWith('addProof')
})

test('submitted buyer gets "Add More Proof" (same branch, non-dispute wording)', () => {
  const onSheet = jest.fn()
  render(<ExchangeCTA offer={matchedOffer('submitted')} userId={BUYER_ID} onSheet={onSheet} {...baseProps} />)

  fireEvent.press(screen.getByText('Add More Proof'))
  expect(onSheet).toHaveBeenCalledWith('addProof')
})

test('submitted buyer ALSO gets a Dispute button (symmetry with the gig worker)', () => {
  const onSheet = jest.fn()
  render(<ExchangeCTA offer={matchedOffer('submitted')} userId={BUYER_ID} onSheet={onSheet} {...baseProps} />)

  // Both affordances: add more evidence AND escalate a stalling seller.
  expect(screen.getByText('Add More Proof')).toBeTruthy()
  fireEvent.press(screen.getByText('Dispute'))
  expect(onSheet).toHaveBeenCalledWith('dispute')
})

test('disputed buyer sees Add Evidence but NOT a redundant Dispute button', () => {
  render(<ExchangeCTA offer={matchedOffer('disputed')} userId={BUYER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Add Evidence')).toBeTruthy()
  expect(screen.queryByText('Dispute')).toBeNull()
})

test('disputed seller (creator) sees no evidence button — evidence is the counterparty’s', () => {
  render(<ExchangeCTA offer={matchedOffer('disputed')} userId={SELLER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.queryByText('Add Evidence')).toBeNull()
  expect(screen.queryByText('Add More Proof')).toBeNull()
})

test('submitted seller still gets Confirm & Release (branch not shadowed by canAddProof)', () => {
  render(<ExchangeCTA offer={matchedOffer('submitted')} userId={SELLER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Confirm & Release')).toBeTruthy()
})

test('submitted buyer past the approval deadline gets Claim Crypto, NOT the proof button', () => {
  // Regression: canAddProof and canClaim are BOTH true here; claiming must win
  // so the buyer can still recover their crypto when the seller stalls.
  const stalled: ExchangeDetail = {
    ...matchedOffer('submitted'),
    approval_deadline: new Date(Date.now() - 60_000).toISOString(),
  }
  render(<ExchangeCTA offer={stalled} userId={BUYER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Claim Crypto')).toBeTruthy()
  expect(screen.queryByText('Add More Proof')).toBeNull()
})

// ── acceptance mode: read from the offer, never assumed ──────────────────
//
// The CTA used to spread UNRESTRICTED_ACCEPTANCE, so every one of these
// rendered Accept Offer. `assigned_counterparty_id` carries no kind restriction
// at create, so an invite-only offer is a state the server really produces.

test('an unrestricted open offer still offers Accept to any non-creator', () => {
  const open = exchangeDetail({ status: 'open' })
  render(<ExchangeCTA offer={open} userId={BUYER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Accept Offer')).toBeTruthy()
})

test('invite-only offer: a stranger gets NO Accept button (the server would 403)', () => {
  // What an outsider actually receives: the flag set, the id withheld. Judging
  // off the id alone would read this as unassigned and offer the button.
  const invited = exchangeDetail({
    status: 'open',
    is_assigned: true,
    assigned_counterparty_id: null,
  })
  render(<ExchangeCTA offer={invited} userId={STRANGER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.queryByText('Accept Offer')).toBeNull()
})

test('invite-only offer: the INVITEE gets Accept (they are a party, so they get the id)', () => {
  const invited = exchangeDetail({ status: 'open', assigned_counterparty_id: BUYER_ID })
  render(<ExchangeCTA offer={invited} userId={BUYER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.getByText('Accept Offer')).toBeTruthy()
})

test('approval-mode offer closes Accept — the field is live, not a hardcoded false', () => {
  // Exchange create rejects `requires_approval` TODAY. The CTA reads the column
  // rather than assuming it, so opening approval mode to exchanges needs no
  // client edit — this test is what holds that open.
  const approval = exchangeDetail({ status: 'open', requires_approval: true })
  render(<ExchangeCTA offer={approval} userId={BUYER_ID} onSheet={noop} {...baseProps} />)
  expect(screen.queryByText('Accept Offer')).toBeNull()
})
