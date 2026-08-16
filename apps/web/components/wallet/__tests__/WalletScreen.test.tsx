/**
 * WalletScreen — the dumb switch over `section`, plus the feed rendering
 * through the shared per-side tx copy (the poster reads "Payout released",
 * the worker "Gig payout", amounts signed from the viewer's seat).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { groupByDay, type UserEscrowTransaction } from '@tenda/shared'

const hookState = {
  user: { id: 'worker-1' } as { id: string } | null,
  section: 'ready' as string,
  retryWallets: vi.fn(),
  retryChains: vi.fn(),
  balances: [] as unknown[],
  totalUsdc: 50,
  earnedUsdc: 80,
  spentUsdc: 30,
  feed: [] as unknown[],
  loadMoreTransactions: vi.fn(),
  hasMoreTransactions: false,
  isLoadingMoreTransactions: false,
  isLoading: false,
  isLoadingTransactions: false,
  refreshing: false,
  handleRefresh: vi.fn(async () => {}),
}
vi.mock('@/hooks/wallet/useWalletScreen', () => ({ useWalletScreen: () => hookState }))

import { WalletScreen } from '@/components/wallet/WalletScreen'

function tx(over: Partial<UserEscrowTransaction>): UserEscrowTransaction {
  return {
    id: 't1',
    escrow_id: 'e1',
    type: 'approve',
    tx_ref: 'sig',
    amount_raw: '48500000',
    platform_fee_raw: null,
    creator_payout_raw: null,
    actor_id: null,
    winner: null,
    created_at: '2026-08-15T09:00:00Z',
    escrow: {
      id: 'e1',
      kind: 'gig',
      title: 'Fix my sink',
      amount_raw: '50000000',
      asset: 'USDC_SOL',
      chain_id: 'solana:devnet',
      status: 'completed',
      creator_id: 'creator-1',
      counterparty_id: 'worker-1',
    },
    ...over,
  }
}

beforeEach(() => {
  hookState.section = 'ready'
  hookState.user = { id: 'worker-1' }
  hookState.feed = []
  hookState.isLoading = false
})

describe('section switch', () => {
  it('ready renders the USDC headline and lifetime totals', () => {
    render(<WalletScreen />)
    expect(screen.getByText('50.00')).toBeInTheDocument()
    expect(screen.getByText('+ 80.00')).toBeInTheDocument()
    expect(screen.getByText('− 30.00')).toBeInTheDocument()
  })

  it('no-wallet invites linking, never a zero balance', () => {
    hookState.section = 'no-wallet'
    render(<WalletScreen />)
    expect(screen.getByRole('link', { name: 'Link a wallet' })).toHaveAttribute(
      'href',
      '/settings/linked-wallets',
    )
    expect(screen.queryByText('50.00')).toBeNull()
  })

  it('wallets-error and balances-unavailable each get their OWN retry', async () => {
    hookState.section = 'wallets-error'
    const first = render(<WalletScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(hookState.retryWallets).toHaveBeenCalled()
    first.unmount()

    hookState.section = 'balances-unavailable'
    render(<WalletScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(hookState.retryChains).toHaveBeenCalled()
  })

  it('loading shows the hero skeleton, not a confident 0.00', () => {
    hookState.section = 'loading'
    render(<WalletScreen />)
    expect(screen.getByTestId('hero-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('0.00')).toBeNull()
  })
})

describe('feed (shared per-side copy)', () => {
  it('words the payout from the WORKER’s side with a credited amount', () => {
    hookState.feed = groupByDay([tx({})], (t) => t.created_at, (t) => t.id, 'tx')
    render(<WalletScreen />)
    expect(screen.getByText('Gig payout')).toBeInTheDocument()
    expect(screen.getByText(/\+48\.5 USDC/)).toBeInTheDocument()
  })

  it('words the same row from the POSTER’s side, uncredited', () => {
    hookState.user = { id: 'creator-1' }
    hookState.feed = groupByDay([tx({})], (t) => t.created_at, (t) => t.id, 'tx')
    render(<WalletScreen />)
    expect(screen.getByText('Payout released')).toBeInTheDocument()
    expect(screen.queryByText(/\+48\.5/)).toBeNull()
  })

  it('empty + settled reads "No transactions yet."', () => {
    render(<WalletScreen />)
    expect(screen.getByText('No transactions yet.')).toBeInTheDocument()
  })

  it('offers Load more only while more pages exist, disabled mid-load', async () => {
    hookState.feed = groupByDay([tx({})], (t) => t.created_at, (t) => t.id, 'tx')
    hookState.hasMoreTransactions = true
    const first = render(<WalletScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(hookState.loadMoreTransactions).toHaveBeenCalledTimes(1)
    first.unmount()

    hookState.isLoadingMoreTransactions = true
    render(<WalletScreen />)
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
    hookState.hasMoreTransactions = false
    hookState.isLoadingMoreTransactions = false
  })
})
