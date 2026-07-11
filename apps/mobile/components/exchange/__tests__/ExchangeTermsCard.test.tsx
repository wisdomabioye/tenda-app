/**
 * ExchangeTermsCard — the #1 fix: the exchange detail must surface the live,
 * status-aware deadline (Accept in / Pay in / Confirm in) as a ticking H:MM:SS
 * clock, not just the static payment-window duration. Statuses with no live
 * deadline show no row.
 */
import { render, screen } from '@testing-library/react-native'
import type { ExchangeDetail, EscrowStatus, UserRef } from '@tenda/shared'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: {
      surface: { card: '#fff' }, border: { default: '#ddd', subtle: '#eee' },
      content: { primary: '#111', secondary: '#555', tertiary: '#999' },
      feedback: {
        warning: { base: '#c97', surface: '#fed', text: '#850', border: '#eca' },
        danger: { base: '#c33', surface: '#fdd', text: '#811', border: '#eaa' },
      },
    } },
  }),
}))
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { ExchangeTermsCard } from '../ExchangeTermsCard'

const iso = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString()
/** The live clock renders as total-hours H:MM:SS ("5:23:04", "49:59:58"). */
const CLOCK = /^\d+:\d{2}:\d{2}$/

const user: UserRef = {
  id: 'u1', first_name: 'A', last_name: 'B', avatar_url: null, review_score: '0', is_seeker: false, country: 'NG',
}

function makeOffer(status: EscrowStatus, deadlines: Partial<Pick<ExchangeDetail, 'accept_deadline' | 'completion_deadline' | 'approval_deadline'>>): ExchangeDetail {
  return {
    escrow_id: 'e1', chain_id: 'solana:devnet', asset: 'USDC_SOL', amount_raw: '100000000',
    status, fiat_amount: '160000', fiat_currency: 'NGN', rate: '1600', payment_window_seconds: 43_200,
    accept_deadline: null, created_at: iso(-1), creator: user, payment_proof_url: null,
    dispute_bond_raw: '0', completion_deadline: null, submitted_at: null, approval_deadline: null,
    counterparty: null, proofs: [], dispute: null, reviews: [], payout_account: null,
    ...deadlines,
  }
}

test('always shows rate and the payment-window duration', () => {
  render(<ExchangeTermsCard offer={makeOffer('open', { accept_deadline: iso(5) })} />)
  expect(screen.getByText('Rate')).toBeTruthy()
  expect(screen.getByText('Payment window')).toBeTruthy()
})

test('open → "Accept in" with a live countdown clock', () => {
  render(<ExchangeTermsCard offer={makeOffer('open', { accept_deadline: iso(5) })} />)
  expect(screen.getByText('Accept in')).toBeTruthy()
  expect(screen.getByText(CLOCK)).toBeTruthy()
})

test('accepted → "Pay in" the completion deadline as a clock', () => {
  render(<ExchangeTermsCard offer={makeOffer('accepted', { completion_deadline: iso(3) })} />)
  expect(screen.getByText('Pay in')).toBeTruthy()
  expect(screen.getByText(CLOCK)).toBeTruthy()
})

test('submitted → "Confirm in" the approval deadline (never gig wording)', () => {
  render(<ExchangeTermsCard offer={makeOffer('submitted', { approval_deadline: iso(10) })} />)
  expect(screen.getByText('Confirm in')).toBeTruthy()
  expect(screen.queryByText('Review by')).toBeNull()
  expect(screen.queryByText('Deliver by')).toBeNull()
})

test('open but indefinitely open (null accept deadline) → no deadline row', () => {
  render(<ExchangeTermsCard offer={makeOffer('open', { accept_deadline: null })} />)
  expect(screen.queryByText('Accept in')).toBeNull()
  expect(screen.queryByText(CLOCK)).toBeNull()
})

test('terminal/draft statuses show no live-deadline row', () => {
  for (const status of ['draft', 'completed', 'cancelled'] as EscrowStatus[]) {
    const { unmount } = render(<ExchangeTermsCard offer={makeOffer(status, { completion_deadline: iso(5) })} />)
    expect(screen.queryByText('Pay in')).toBeNull()
    expect(screen.queryByText('Accept in')).toBeNull()
    unmount()
  }
})
