/**
 * GigCTABar — disputed-state actions. The worker (counterparty) can keep
 * adding evidence for the mediator while a dispute is open; the poster only
 * sees the "under review" notice. Regression: a submitted worker still gets
 * the normal add-more-proof row.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { GigDetail, UserRef } from '@tenda/shared'
import { GigCTABar } from '@/components/gig/GigCTABar'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        surface: { background: '#fff' },
        border: { subtle: '#eee' },
        feedback: { warning: { surface: '#fe8', base: '#a60' } },
      },
    },
  }),
}))
jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  }
})
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

const CREATOR = 'creator-id'
const WORKER = 'worker-id'

function user(id: string): UserRef {
  return {
    id,
    first_name: 'A',
    last_name: 'B',
    avatar_url: null,
    review_score: null,
    country: 'NG',
    is_seeker: false,
  }
}

function gig(overrides: Partial<GigDetail> = {}): GigDetail {
  return {
    escrow_id: 'e1',
    chain_id: 'solana:devnet',
    asset: 'USDC_SOL',
    amount_raw: '1000000',
    status: 'disputed',
    accept_deadline: null,
    created_at: '2026-07-01T00:00:00.000Z',
    title: 'Paint the fence',
    description: null,
    category: 'service',
    country: 'NG',
    city: 'Lagos',
    latitude: null,
    longitude: null,
    remote: false,
    cross_border: false,
    proof_requirements: [],
    creator: user(CREATOR),
    completion_duration_seconds: 3600,
    completion_deadline: null,
    submitted_at: null,
    approval_deadline: null,
    dispute_bond_raw: '0',
    assigned_counterparty_id: WORKER,
    counterparty: user(WORKER),
    proofs: [],
    dispute: null,
    reviews: [],
    is_seeker: false,
    ...overrides,
  }
}

const noop = () => {}
const props = { isTxBuilding: false, txInProgress: false, onTxAction: noop, onRetryDraft: noop }

test('disputed worker sees an Add Evidence button that opens the add-proof sheet', () => {
  const onAction = jest.fn()
  render(<GigCTABar gig={gig()} userId={WORKER} onAction={onAction} {...props} />)

  const btn = screen.getByText('Add Evidence')
  expect(btn).toBeTruthy()
  expect(screen.getByText('Under review by admin')).toBeTruthy()
  fireEvent.press(btn)
  expect(onAction).toHaveBeenCalledWith('addProof')
})

test('disputed poster sees only the under-review notice, no evidence button', () => {
  render(<GigCTABar gig={gig()} userId={CREATOR} onAction={noop} {...props} />)

  expect(screen.getByText('Under review by admin')).toBeTruthy()
  expect(screen.queryByText('Add Evidence')).toBeNull()
})

test('disputed shows no redundant Dispute button', () => {
  render(<GigCTABar gig={gig()} userId={WORKER} onAction={noop} {...props} />)
  expect(screen.queryByText('Dispute')).toBeNull()
})

test('regression — submitted worker still gets the add-more-proof row', () => {
  render(<GigCTABar gig={gig({ status: 'submitted' })} userId={WORKER} onAction={noop} {...props} />)
  expect(screen.getByText('Add More Proof')).toBeTruthy()
})
