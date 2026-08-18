/**
 * ExchangeDetailApp — the exchange hub over the gig-proven machinery:
 * the CTA rides the TxConfirmDialog gate before any hook action fires,
 * the monitor's confirm/fail exits route correctly (cancel leaves the
 * dead page), a takedown refusal re-reads, and the payout surfaces obey
 * the role gates (buyer instructions vs seller payout — never both).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ExchangePayoutAccount } from '@tenda/shared'

const { actionsState, capturedActionsArgs, capturedDialogArgs, capturedCheckApplied, toastMock, routerPush, liveRefreshMock } = vi.hoisted(() => ({
  actionsState: {
    busyAction: null as string | null,
    pendingTxRef: null as string | null,
    pendingAction: null as 'cancel' | 'accept' | null,
    phase: 'idle',
    activeAction: null,
    clearPending: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    approve: vi.fn(),
    claim: vi.fn(),
    cancel: vi.fn(),
    publish: vi.fn(),
    submit: vi.fn(),
    addProofs: vi.fn(),
    dispute: vi.fn(),
  },
  capturedActionsArgs: { current: null as null | { onStale?: () => void } },
  // The dialogs and the monitor are mocked, so their callbacks are captured
  // rather than clicked — they are still THIS page's wiring, and the two below
  // are the only ways an added proof or a converged tx reaches the screen.
  capturedDialogArgs: { current: null as null | { onAddProofsReady?: (p: unknown[]) => Promise<void> } },
  capturedCheckApplied: { current: null as null | (() => Promise<boolean>) },
  toastMock: vi.fn(),
  routerPush: vi.fn(),
  liveRefreshMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }))
vi.mock('@/components/ui/Toast', () => ({ showToast: (...a: unknown[]) => toastMock(...a) }))
vi.mock('@/components/escrow/TransactionMonitor', () => ({
  TransactionMonitor: ({
    onConfirmed,
    onFailed,
    checkApplied,
  }: {
    onConfirmed: () => void
    onFailed: (m: string) => void
    checkApplied: () => Promise<boolean>
  }) => {
    capturedCheckApplied.current = checkApplied
    return (
      <div>
        <button onClick={onConfirmed}>monitor-confirm</button>
        <button onClick={() => onFailed('rpc gave up')}>monitor-fail</button>
      </div>
    )
  },
}))
vi.mock('@/hooks/escrow/useEscrowActions', () => ({
  useEscrowActions: (args: { onStale?: () => void }) => {
    capturedActionsArgs.current = args
    return actionsState
  },
}))
vi.mock('@/hooks/escrow/useEscrowFee', () => ({
  useEscrowFee: () => ({ feeBps: 250, feePct: '2.50', feeRaw: BigInt(1250000), netRaw: BigInt(48750000) }),
}))
vi.mock('@/hooks/escrow/live', () => ({
  useEscrowLiveRefresh: (...a: unknown[]) => liveRefreshMock(...a),
}))
// The dialogs' internals are unit-tested with the gig hub; here they would
// only drag in upload plumbing.
vi.mock('@/components/gig/detail/action-dialogs', () => ({
  GigActionDialogs: (args: { onAddProofsReady?: (p: unknown[]) => Promise<void> }) => {
    capturedDialogArgs.current = args
    return null
  },
}))
vi.mock('@/api/client', () => ({
  api: {
    exchange: { get: vi.fn() },
    users: { standing: vi.fn(() => new Promise(() => {})) },
  },
}))

import { api } from '@/api/client'
import { ExchangeDetailApp } from '@/components/exchange/ExchangeDetailApp'
import { OFFER_ASIDE_COPY, OFFER_DETAIL_COPY } from '@/components/exchange/detail'
import { makeExchangeDetail, makeUserRef } from '../../../test/factories/exchange'

const ACCOUNT: ExchangePayoutAccount = {
  kind: 'bank',
  bank_code: '058',
  account_number: '0123456789',
  account_name: 'Ada Okafor',
  country: 'NG',
}

const refresh = vi.fn(async () => {})

beforeEach(() => {
  vi.clearAllMocks()
  actionsState.pendingTxRef = null
  actionsState.pendingAction = null
})

test('a stranger on an open offer: Accept gates behind the confirm dialog', async () => {
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Accept Offer' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Accept this offer?' })
  expect(actionsState.accept).not.toHaveBeenCalled() // the gate really gates
  fireEvent.click(within(dialog).getByRole('button', { name: 'Accept Offer' }))
  expect(actionsState.accept).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
})

test('a confirmed non-cancel tx toasts and re-reads; a confirmed CANCEL leaves for /exchange', () => {
  actionsState.pendingTxRef = 'sig-1'
  actionsState.pendingAction = 'accept'
  const { unmount } = render(
    <ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'monitor-confirm' }))
  expect(actionsState.clearPending).toHaveBeenCalled()
  expect(toastMock).toHaveBeenCalledWith('success', expect.stringMatching(/./))
  expect(refresh).toHaveBeenCalled()
  expect(routerPush).not.toHaveBeenCalled()
  unmount()

  refresh.mockClear()
  actionsState.pendingAction = 'cancel'
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="seller-1" refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'monitor-confirm' }))
  expect(routerPush).toHaveBeenCalledWith('/exchange')
  expect(refresh).not.toHaveBeenCalled()
})

test('a monitor failure clears the pending tx and reports still-syncing info', () => {
  actionsState.pendingTxRef = 'sig-1'
  actionsState.pendingAction = 'accept'
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'monitor-fail' }))
  expect(actionsState.clearPending).toHaveBeenCalled()
  expect(toastMock).toHaveBeenCalledWith('info', 'rpc gave up')
})

test('a takedown refusal (onStale) re-reads so dead buttons disappear', () => {
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)
  refresh.mockClear()
  capturedActionsArgs.current?.onStale?.()
  expect(refresh).toHaveBeenCalled()
})

test('payout surfaces: the accepted BUYER sees instructions, the SELLER sees the bound account — never both', () => {
  const accepted = makeExchangeDetail({
    status: 'accepted',
    payout_account: ACCOUNT,
    counterparty: makeUserRef({ id: 'buyer-1', first_name: 'Bola', last_name: 'Ade' }),
  })
  const asBuyer = render(<ExchangeDetailApp offer={accepted} userId="buyer-1" refresh={refresh} />)
  expect(screen.getByText('Pay the seller')).toBeInTheDocument()
  expect(screen.queryByText('Buyer pays into')).toBeNull()
  asBuyer.unmount()

  render(<ExchangeDetailApp offer={accepted} userId="seller-1" refresh={refresh} />)
  expect(screen.getByText('Buyer pays into')).toBeInTheDocument()
  expect(screen.queryByText('Pay the seller')).toBeNull()
})

test('the party half is rendered from what the SERVER sent, never synthesised', () => {
  // An outsider's wire has counterparty null, proofs [], dispute null — the
  // page must draw none of those blocks rather than empty shells that reveal
  // the shape of what is being withheld.
  const outsider = render(
    <ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />,
  )
  expect(screen.queryByText(OFFER_DETAIL_COPY.proofs)).toBeNull()
  expect(screen.queryByText('Buyer')).toBeNull()
  outsider.unmount()

  render(
    <ExchangeDetailApp
      offer={makeExchangeDetail({
        status: 'disputed',
        counterparty: makeUserRef({ id: 'buyer-1', first_name: 'Bola', last_name: 'Ade' }),
        proofs: [
          {
            id: 'proof-1',
            escrow_id: 'exch-1',
            // A REAL proof type: `PROOF_TYPES` is image | video | document,
            // so the row this asserts on is one the server can actually send.
            type: 'image',
            url: 'https://cdn.test/receipt.png',
            uploaded_at: new Date('2026-08-16T10:00:00.000Z'),
          },
        ],
        // The REAL `Dispute` row: an open dispute is one with no winner and no
        // `resolved_at`. There is no `status` column on it — the escrow's own
        // status is what says the trade is in dispute, and that is exactly what
        // the page gates the block on.
        dispute: {
          id: 'dsp-1',
          escrow_id: 'exch-1',
          raised_by: 'buyer-1',
          reason: 'Payment sent, not released',
          assigned_to: null,
          assigned_at: null,
          winner: null,
          resolved_by: null,
          resolved_at: null,
          created_at: new Date('2026-08-16T10:00:00.000Z'),
        },
      })}
      userId="buyer-1"
      refresh={refresh}
    />,
  )
  expect(screen.getByText(OFFER_DETAIL_COPY.proofs)).toBeInTheDocument()
  // The proof is OPENABLE: a list that only says one exists settles nothing.
  expect(screen.getByRole('link', { name: 'image proof' })).toHaveAttribute(
    'href',
    'https://cdn.test/receipt.png',
  )
  expect(screen.getByText('Buyer')).toBeInTheDocument()
  expect(screen.getByText('Payment sent, not released')).toBeInTheDocument()
})

test('the aside speaks to the reader’s OWN side of the trade', () => {
  const asSeller = render(
    <ExchangeDetailApp offer={makeExchangeDetail()} userId="seller-1" refresh={refresh} />,
  )
  expect(screen.getByText(OFFER_ASIDE_COPY.sellerPay)).toBeInTheDocument()
  expect(screen.queryByText(OFFER_DETAIL_COPY.youPay)).toBeNull()
  asSeller.unmount()

  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)
  expect(screen.getByText(OFFER_DETAIL_COPY.youPay)).toBeInTheDocument()
  expect(screen.queryByText(OFFER_ASIDE_COPY.sellerPay)).toBeNull()
})

test('the live-refresh subscription rides the offer identity', () => {
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)
  expect(liveRefreshMock).toHaveBeenCalledWith('exch-1', refresh, 'open')
})

test('an added proof re-reads the offer only when the upload actually landed', async () => {
  // `addProofs` answers false on a refusal. Re-reading then would repaint the
  // page for nothing; NOT re-reading on success would leave the proof the
  // reader just uploaded off the screen until they reloaded.
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="buyer-1" refresh={refresh} />)

  actionsState.addProofs.mockResolvedValueOnce(false)
  await capturedDialogArgs.current?.onAddProofsReady?.([])
  expect(refresh).not.toHaveBeenCalled()

  actionsState.addProofs.mockResolvedValueOnce(true)
  await capturedDialogArgs.current?.onAddProofsReady?.([])
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('the monitor converges against THIS offer, not the escrow route', async () => {
  // The exchange detail endpoint is what carries the exchange's status; asking
  // the gig route would answer 404 and the monitor would never converge.
  const exchangeGet = vi.mocked(api.exchange.get)
  exchangeGet.mockResolvedValue(makeExchangeDetail({ status: 'accepted' }))
  actionsState.pendingAction = 'accept'
  render(<ExchangeDetailApp offer={makeExchangeDetail()} userId="stranger" refresh={refresh} />)

  await expect(capturedCheckApplied.current?.()).resolves.toBe(true)
  expect(exchangeGet).toHaveBeenCalledWith({ id: 'exch-1' })
})
