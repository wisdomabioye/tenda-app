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

/** Minimal USDC settlement tx as the wire delivers it. */
function usdcTx(over: {
  type: string
  amount_raw: string | null
  platform_fee_raw?: string | null
  counterparty_id?: string | null
  creator_id?: string
  winner?: 'creator' | 'counterparty' | 'split' | null
}) {
  return {
    id: `t-${Math.random()}`, escrow_id: 'e1', type: over.type, tx_ref: `sig-${Math.random()}`,
    amount_raw: over.amount_raw, platform_fee_raw: over.platform_fee_raw ?? null,
    actor_id: null, created_at: '2026-07-17T10:00:00.000Z', winner: over.winner ?? null,
    escrow: {
      id: 'e1', kind: 'exchange', title: null, amount_raw: '2000000', asset: 'USDC_SOL',
      chain_id: 'solana:devnet', status: 'completed',
      creator_id: over.creator_id ?? 'seller-1',
      counterparty_id: over.counterparty_id === undefined ? 'u1' : over.counterparty_id,
    },
  }
}

test('EARNED sums the chain-attested NET payout — no second fee subtraction', async () => {
  // Contract event: 2 USDC principal, 1% fee → amount(net)=1.98, fee=0.02.
  // The OLD math did net − fee again (1.96) — the double-charge this pins out.
  mockTxns.mockResolvedValue({ data: [
    usdcTx({ type: 'approve', amount_raw: '1980000', platform_fee_raw: '20000' }),
  ] })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(1.98, 6))
})

test('EARNED skips settlement rows with no attested amount (never guesses the principal)', async () => {
  mockTxns.mockResolvedValue({ data: [
    usdcTx({ type: 'approve', amount_raw: null }), // legacy EVM row: event carried no amount
    usdcTx({ type: 'claim_stalled', amount_raw: '990000', platform_fee_raw: '10000' }),
  ] })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(0.99, 6))
})

test('EARNED counts resolve payouts to the counterparty, including a split share', async () => {
  mockTxns.mockResolvedValue({ data: [
    usdcTx({ type: 'resolve', amount_raw: '1000000', winner: 'split' }),
    usdcTx({ type: 'resolve', amount_raw: '0', winner: 'creator' }), // lost dispute → credits nothing
  ] })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.earnedUsdc).toBeCloseTo(1, 6))
})

test('EARNED never counts rows where the viewer is not the counterparty', async () => {
  mockTxns.mockResolvedValue({ data: [
    usdcTx({ type: 'approve', amount_raw: '1980000', counterparty_id: 'someone-else' }),
  ] })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.earnedUsdc).toBe(0)
})

test('SPENT counts the creator\'s funding rows at the full escrowed principal', async () => {
  mockTxns.mockResolvedValue({ data: [
    usdcTx({ type: 'create', amount_raw: '2000000', creator_id: 'u1', counterparty_id: null }),
  ] })
  const { result } = renderHook(() => useWalletScreen())
  await waitFor(() => expect(result.current.spentUsdc).toBeCloseTo(2, 6))
})

test('surfaces walletsStatus and the retry handler so the screen can distinguish load states', async () => {
  mockWalletsStatus = 'error'
  const { result } = renderHook(() => useWalletScreen())
  expect(result.current.walletsStatus).toBe('error')
  expect(result.current.retryWallets).toBe(mockRetry)
  await waitFor(() => expect(result.current.isLoading).toBe(false)) // settle the load effect
})
