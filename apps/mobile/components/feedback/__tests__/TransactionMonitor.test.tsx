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
  return { Button: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

// Controllable RPC status: default idle; individual tests override.
const mockGetTransactionStatus = jest.fn().mockResolvedValue('not_found')
jest.mock('@/wallet', () => ({
  getTransactionStatus: (...a: unknown[]) => mockGetTransactionStatus(...a),
  getEvmTransactionStatus: jest.fn().mockResolvedValue('not_found'),
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
})

test('idle phase with no signature renders nothing', () => {
  render(<TransactionMonitor signature={null} phase="idle" onConfirmed={noop} onFailed={noop} />)
  expect(screen.queryByText('Preparing transaction…')).toBeNull()
  expect(screen.queryByText('Approve in your wallet')).toBeNull()
})

test('preparing phase shows the build-in-progress copy before any wallet prompt', () => {
  render(<TransactionMonitor signature={null} phase="preparing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.getByText('Preparing transaction…')).toBeTruthy()
})

test('signing phase tells the user their wallet is opening (the key newcomer cue)', () => {
  render(<TransactionMonitor signature={null} phase="signing" onConfirmed={noop} onFailed={noop} />)
  expect(screen.getByText('Approve in your wallet')).toBeTruthy()
  expect(screen.getByText(/approve the transaction there/i)).toBeTruthy()
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
