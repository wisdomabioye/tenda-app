/**
 * useWalletScreen, multichain data controller. Asserts the no-wallet loading
 * fix (isLoading must SETTLE, not strand the skeleton, when no wallet is linked
 *, the old hook early-returned and looped forever) and the USDC-total wiring.
 */
import { renderHook, waitFor } from '@testing-library/react-native'

let mockUser: { id: string } | null = { id: 'u1' }
let mockWallets: Array<{ chain_ns: string; address: string }> = []
let mockWalletsStatus = 'ready'
const mockRetry = jest.fn()
let mockChains: unknown[] = []
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: mockUser, wallets: mockWallets, walletsStatus: mockWalletsStatus, retryWalletSync: mockRetry }),
}))
jest.mock('@/stores/chain-registry.store', () => ({
  useChainRegistryStore: (sel: (s: unknown) => unknown) => sel({ chains: mockChains }),
}))

const mockRead = jest.fn((_wallets?: unknown, _chains?: unknown) => Promise.resolve([] as unknown[]))
const mockSum = jest.fn((_balances?: unknown) => '0')
jest.mock('@/wallet/balances', () => ({
  readWalletBalances: (wallets: unknown, chains: unknown) => mockRead(wallets, chains),
  sumUsdcRaw: (balances: unknown) => mockSum(balances),
}))
const mockTxns = jest.fn((_args?: unknown) => Promise.resolve({ data: [] as unknown[] }))
jest.mock('@/api/client', () => ({ api: { users: { transactions: (args: unknown) => mockTxns(args) } } }))
// Run the focus effect once on mount (mirrors focus), not every render.
jest.mock('expo-router', () => {
  const React = require('react')
  return { useFocusEffect: (cb: () => void) => React.useEffect(() => { cb() }, [cb]) }
})

import { useWalletScreen } from '@/hooks/useWalletScreen'

beforeEach(() => {
  mockUser = { id: 'u1' }
  mockWallets = []
  mockWalletsStatus = 'ready'
  mockRetry.mockReset()
  mockChains = []
  mockRead.mockReset().mockResolvedValue([])
  mockSum.mockReset().mockReturnValue('0')
  mockTxns.mockReset().mockResolvedValue({ data: [] })
})

test('no wallet linked → hasWallet false and isLoading SETTLES (no infinite skeleton)', async () => {
  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.hasWallet).toBe(false)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  // It still attempts a read (with an empty wallet list) rather than early-returning.
  expect(mockRead).toHaveBeenCalledWith([], [])
})

test('with a wallet → reads balances and derives the USDC headline total', async () => {
  mockWallets = [{ chain_ns: 'solana', address: 'SoL' }]
  mockChains = [{ id: 'solana:devnet', namespace: 'solana', display_name: 'Solana', assets: [] }]
  mockRead.mockResolvedValue([
    { chainId: 'solana:devnet', namespace: 'solana', displayName: 'Solana', address: 'SoL',
      usdc: { assetId: 'USDC_SOL', symbol: 'USDC', amountRaw: '50000000', decimals: 6, isStable: true }, native: null },
  ])
  mockSum.mockReturnValue('50000000') // 50 USDC (6dp)

  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.hasWallet).toBe(true)
  await waitFor(() => expect(result.current.balances).toHaveLength(1))
  expect(result.current.totalUsdc).toBe(50)
})

test('surfaces walletsStatus and the retry handler so the screen can distinguish load states', async () => {
  mockWalletsStatus = 'error'
  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.walletsStatus).toBe('error')
  expect(result.current.retryWallets).toBe(mockRetry)
  await waitFor(() => expect(result.current.isLoading).toBe(false)) // settle the load effect
})
