/**
 * TxRow — the wallet feed's honesty contract. Settlement credits show the
 * chain-attested NET amount or nothing at all; the old gross-principal
 * fallback overstated every credit on chains whose events carried no amount.
 */
import { render, screen } from '@testing-library/react-native'
import { ESCROW_TX_TYPES, type UserEscrowTransaction, type EscrowTxType } from '@tenda/shared'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: {
      surface: { card: '#fff' }, border: { subtle: '#eee' },
      content: { primary: '#111', secondary: '#555', tertiary: '#999' },
      brand: { primary: '#0a0', primarySurface: '#efe' },
      accent: { primary: '#a0a', primarySurface: '#fef' },
      numeric: { positive: '#080', negative: '#800' },
    } },
  }),
}))
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { TxRow } from '../TxRow'

const VIEWER = 'u1'

function tx(over: Partial<UserEscrowTransaction> & { type: EscrowTxType }): UserEscrowTransaction {
  return {
    id: 't1', escrow_id: 'e1', tx_ref: 'sig1', amount_raw: null, platform_fee_raw: null,
    creator_payout_raw: null, actor_id: null, created_at: '2026-07-17T10:00:00.000Z', winner: null,
    escrow: {
      id: 'e1', kind: 'exchange', title: null, amount_raw: '2000000', asset: 'USDC_SOL',
      chain_id: 'solana:devnet', status: 'completed', creator_id: 'seller-1', counterparty_id: VIEWER,
    },
    ...over,
  }
}

test('a credited settlement shows the NET event amount, not the 2 USDC principal', () => {
  render(<TxRow tx={tx({ type: 'approve', amount_raw: '1980000', platform_fee_raw: '20000' })} userId={VIEWER} />)
  expect(screen.getByText(/1\.98/)).toBeTruthy()
  expect(screen.queryByText(/^\+ 2$/)).toBeNull()
})

test('a settlement credit with NO attested amount shows no number (never the principal)', () => {
  render(<TxRow tx={tx({ type: 'approve', amount_raw: null })} userId={VIEWER} />)
  expect(screen.queryByText(/2/)).toBeNull()
  expect(screen.getByText('Crypto released')).toBeTruthy() // the row itself still renders
})

test('claim_stalled behaves like approve: attested net or nothing', () => {
  render(<TxRow tx={tx({ type: 'claim_stalled', amount_raw: null })} userId={VIEWER} />)
  expect(screen.queryByText(/2/)).toBeNull()
})

test('a refund row still falls back to the principal — a refund IS the full amount', () => {
  render(
    <TxRow
      tx={tx({ type: 'cancel', escrow: {
        id: 'e1', kind: 'exchange', title: null, amount_raw: '2000000', asset: 'USDC_SOL',
        chain_id: 'solana:devnet', status: 'cancelled', creator_id: VIEWER, counterparty_id: null,
      } })}
      userId={VIEWER}
    />,
  )
  expect(screen.getByText(/^\+/)).toBeTruthy()
  expect(screen.getByText(/2/)).toBeTruthy()
})

test('a split resolve shows each viewer THEIR OWN share, not the counterparty\'s', () => {
  const split = tx({
    type: 'resolve', winner: 'split',
    amount_raw: '1200000', creator_payout_raw: '800000', // uneven split for distinguishability
  })
  render(<TxRow tx={split} userId={VIEWER} />) // viewer = counterparty
  expect(screen.getByText(/1\.2/)).toBeTruthy()

  render(<TxRow tx={split} userId="seller-1" />) // viewer = creator
  expect(screen.getByText(/0\.8/)).toBeTruthy()
})

test('a creator-wins resolve credits the creator their attested share', () => {
  const won = tx({ type: 'resolve', winner: 'creator', amount_raw: '0', creator_payout_raw: '2000000' })
  render(<TxRow tx={won} userId="seller-1" />)
  expect(screen.getByText(/^\+/)).toBeTruthy()
  expect(screen.getByText(/2/)).toBeTruthy()
})

test('a counterparty-wins resolve credits the counterparty their net share', () => {
  const won = tx({ type: 'resolve', winner: 'counterparty', amount_raw: '1980000', creator_payout_raw: '0' })
  render(<TxRow tx={won} userId={VIEWER} />)
  expect(screen.getByText(/1\.98/)).toBeTruthy()
})

test('a resolve row with no attested payouts shows no number for either party', () => {
  const legacy = tx({ type: 'resolve', winner: 'counterparty' })
  render(<TxRow tx={legacy} userId={VIEWER} />)
  expect(screen.queryByText(/2/)).toBeNull()
})

test('funding shows the escrowed principal as a debit to the creator', () => {
  render(
    <TxRow
      tx={tx({ type: 'create', amount_raw: '2000000', escrow: {
        id: 'e1', kind: 'gig', title: 'Logo gig', amount_raw: '2000000', asset: 'USDC_SOL',
        chain_id: 'solana:devnet', status: 'open', creator_id: VIEWER, counterparty_id: null,
      } })}
      userId={VIEWER}
    />,
  )
  expect(screen.getByText(/^−|^-/)).toBeTruthy()
})

describe('transaction labels', () => {
  // The maps are total, so this can only fail if someone reintroduces a
  // fallback — but a raw enum slug in a user's money history is bad enough to
  // pin. `assign_accept` is the case that motivated it: the type exists so a
  // poster's row does NOT read "Gig accepted", and a fallback would have made
  // it read "assign_accept".
  it('never renders a raw enum slug, on either kind', () => {
    for (const type of ESCROW_TX_TYPES) {
      for (const kind of ['gig', 'exchange'] as const) {
        const { unmount } = render(
          <TxRow tx={tx({ type, escrow: { ...tx({ type }).escrow, kind } })} userId={VIEWER} />,
        )
        expect(screen.queryByText(type)).toBeNull()
        unmount()
      }
    }
  })

  it('labels the approval-mode rows from the actor’s side, per kind', () => {
    const gigEscrow = { ...tx({ type: 'assign_accept' }).escrow, kind: 'gig' as const }
    render(<TxRow tx={tx({ type: 'assign_accept', escrow: gigEscrow })} userId={VIEWER} />)
    expect(screen.getByText('Worker assigned')).toBeTruthy()

    // The default fixture is an exchange, which reads from the P2P side.
    render(<TxRow tx={tx({ type: 'assign_accept' })} userId={VIEWER} />)
    expect(screen.getByText('Buyer matched')).toBeTruthy()
  })

  it('carries no +/- sign for assign/unassign — neither moves value', () => {
    for (const type of ['assign_accept', 'unassign'] as const) {
      const { unmount } = render(<TxRow tx={tx({ type })} userId={VIEWER} />)
      expect(screen.queryByText(/^[+-]/)).toBeNull()
      unmount()
    }
  })
})
