/**
 * TransactionMonitor phase UX. Verifies the pre-signature guidance the
 * blockchain-newcomer flow depends on: the modal opens on `phase` alone
 * (before any signature), shows "Approve in your wallet" while the popup is
 * up, names the action while confirming, and stays closed when idle with no
 * tx. The RPC/WS confirm path is covered by the wallet adapters; here the
 * transports are stubbed so nothing polls.
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        brand: { primary: '#0a0' },
        surface: { card: '#fff' },
        content: { secondary: '#555' },
        feedback: { success: { base: '#0a0' }, danger: { base: '#a00' } },
      },
    },
  }),
}))

jest.mock('lucide-react-native', () => ({
  CheckCircle: () => null,
  XCircle: () => null,
  Wallet: () => null,
}))

jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  }
})

// Controllable RPC status: default idle; individual tests override.
const mockGetTransactionStatus = jest.fn().mockResolvedValue('not_found')
// Controllable guarded-request registry: drives the signing-phase Cancel.
let mockHasPending = false
const mockPendingSubscribers = new Set<() => void>()
const mockAbortPending = jest.fn()
jest.mock('@/wallet', () => ({
  getTransactionStatus: (...a: unknown[]) => mockGetTransactionStatus(...a),
  getEvmTransactionStatus: jest.fn().mockResolvedValue('not_found'),
  abortPendingWalletRequest: () => mockAbortPending(),
  hasPendingWalletRequest: () => mockHasPending,
  subscribePendingWalletRequest: (listener: () => void) => {
    mockPendingSubscribers.add(listener)
    return () => {
      mockPendingSubscribers.delete(listener)
    }
  },
}))

// Capture the WS subscriber so tests can push a confirmation frame.
let wsCallback: ((frame: { tx_ref: string }) => void) | null = null
jest.mock('@/stores/realtime.store', () => ({
  useRealtimeStore: { getState: () => ({ connected: false }) },
  subscribeEscrowChannel: (_id: string, cb: (frame: { tx_ref: string }) => void) => {
    wsCallback = cb
    return () => {
      wsCallback = null
    }
  },
}))

import { TransactionMonitor } from '@/components/feedback/TransactionMonitor'

const noop = () => {}

beforeEach(() => {
  wsCallback = null
  mockGetTransactionStatus.mockReset().mockResolvedValue('not_found')
  mockHasPending = false
  mockPendingSubscribers.clear()
  mockAbortPending.mockReset()
})

test('idle phase with no signature renders nothing', () => {
  render(<TransactionMonitor signature={null} phase="idle" onConfirmed={noop} onFailed={noop} />)
  expect(screen.queryByText('Preparing transaction…')).toBeNull()
  expect(screen.queryByText('Approve in your wallet')).toBeNull()
})

test('preparing phase shows the build-in-progress copy before any wallet prompt', () => {
  render(<TransactionMonitor signature={null} phase="preparing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.getByText('Preparing transaction…')).toBeTruthy()
  expect(screen.getByText('Getting your request ready, one moment.')).toBeTruthy()
})

test('preparingCaption overrides the default caption (gig moderation-review wait)', () => {
  const caption = 'Reviewing your gig against our guidelines — this takes a few seconds before your wallet opens.'
  render(
    <TransactionMonitor
      signature={null}
      phase="preparing"
      preparingCaption={caption}
      onConfirmed={noop}
      onFailed={noop}
    />,
  )
  expect(screen.getByText(caption)).toBeTruthy()
  expect(screen.queryByText('Getting your request ready, one moment.')).toBeNull()
})

test('signing phase tells the user their wallet is opening (the key newcomer cue)', () => {
  render(<TransactionMonitor signature={null} phase="signing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.getByText('Approve in your wallet')).toBeTruthy()
  expect(screen.getByText(/approve the transaction there/i)).toBeTruthy()
})

test('signing phase shows NO Cancel when nothing is abortable (Solana/MWA path)', () => {
  render(<TransactionMonitor signature={null} phase="signing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.queryByText('Cancel')).toBeNull()
})

test('signing phase offers Cancel while a WC request is in flight, and it aborts', () => {
  mockHasPending = true
  render(<TransactionMonitor signature={null} phase="signing" onConfirmed={noop} onFailed={noop} />)
  fireEvent.press(screen.getByText('Cancel'))
  expect(mockAbortPending).toHaveBeenCalledTimes(1)
})

test('Cancel appears live when a guarded request starts mid-signing', () => {
  render(<TransactionMonitor signature={null} phase="signing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.queryByText('Cancel')).toBeNull()
  // The guard registers its request and notifies (useSyncExternalStore).
  act(() => {
    mockHasPending = true
    for (const listener of mockPendingSubscribers) listener()
  })
  expect(screen.getByText('Cancel')).toBeTruthy()
})

test('confirming phase names the action via actionLabel', () => {
  render(
    <TransactionMonitor
      signature="sig123"
      phase="confirming"
      actionLabel="Releasing payment"
      escrowId="e1"
      chainId="solana:devnet"
      onConfirmed={noop}
      onFailed={noop}
    />,
  )
  expect(screen.getByText('Releasing payment…')).toBeTruthy()
})

test('legacy caller (no phase) still opens on a broadcast signature', () => {
  render(
    <TransactionMonitor signature="sig123" escrowId="e1" chainId="solana:devnet" onConfirmed={noop} onFailed={noop} />,
  )
  expect(screen.getByText('Confirming transaction…')).toBeTruthy()
})

test('a WS confirmation frame settles confirmed and calls onConfirmed', async () => {
  jest.useFakeTimers()
  const onConfirmed = jest.fn()
  render(
    <TransactionMonitor
      signature="sig-ws"
      phase="confirming"
      escrowId="e1"
      chainId="solana:devnet"
      onConfirmed={onConfirmed}
      onFailed={noop}
    />,
  )
  // Push the matching escrow frame over the socket.
  act(() => {
    wsCallback?.({ tx_ref: 'sig-ws' })
  })
  expect(screen.getByText('Transaction confirmed!')).toBeTruthy()
  // Confirmed auto-dismisses after CONFIRM_DISMISS_MS.
  act(() => {
    jest.advanceTimersByTime(800)
  })
  expect(onConfirmed).toHaveBeenCalledTimes(1)
  jest.useRealTimers()
})

test('a failed on-chain status shows the issue state and Dismiss routes to onFailed', async () => {
  mockGetTransactionStatus.mockResolvedValue('failed')
  const onFailed = jest.fn()
  render(
    <TransactionMonitor
      signature="sig-fail"
      phase="confirming"
      chainId="solana:devnet"
      onConfirmed={noop}
      onFailed={onFailed}
    />,
  )
  await waitFor(() => expect(screen.getByText('Transaction issue')).toBeTruthy())
  fireEvent.press(screen.getByText('Dismiss'))
  expect(onFailed).toHaveBeenCalledWith('Transaction failed on chain.')
})
