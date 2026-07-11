/**
 * useOfferSell — posting a P2P sell offer. Verifies the caller-chosen windows
 * thread through (accept → deadline unix, payment window → BOTH the escrow
 * completion duration and the offer payment_window), plus the negative paths:
 * draft cleanup on terms failure, the 9D gate, and signing-declined → draft.
 */
import { renderHook, act } from '@testing-library/react-native'
import type { BankAccountSummary } from '@tenda/shared'
import type { ExchangeAssetOption } from '@/hooks/useExchangeAssetOptions'

const NOW_MS = 1_700_000_000_000
const NOW_S = Math.floor(NOW_MS / 1000)

const mockCreate = jest.fn()
const mockDelete = jest.fn().mockResolvedValue(undefined)
const mockExchangeCreate = jest.fn()
const mockSign = jest.fn().mockResolvedValue('tx-ref')
const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockToast = jest.fn()
let mockGate: string | null = null

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }))
jest.mock('@/api/client', () => ({
  api: {
    escrows: { create: (b: unknown) => mockCreate(b), delete: (b: unknown) => mockDelete(b) },
    exchange: { create: (b: unknown) => mockExchangeCreate(b) },
  },
  ApiClientError: class ApiClientError extends Error {
    constructor(_status: number, _error: string, message: string) { super(message) }
  },
}))
jest.mock('@/components/ui', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }))
jest.mock('@/wallet/dispatch', () => ({ signSendAndReport: (a: unknown) => mockSign(a) }))
jest.mock('@/lib/transaction-gate', () => ({
  classifyTransactionGateError: () => mockGate,
  TRANSACTION_GATE_MESSAGE: { link_wallet: 'link a wallet' },
  transactionGateRoute: () => '/settings/linked-wallets',
}))

import { useOfferSell } from '../useOfferSell'
import { ApiClientError } from '@/api/client'

const OPTION = {
  chainId: 'eip155:84532', assetId: 'USDC_BASE', symbol: 'USDC', decimals: 6, chainName: 'Base', walletAddress: '0xEvm',
} as ExchangeAssetOption
const ACCOUNT = { id: 'acc1', country: 'NG' } as BankAccountSummary
const ARGS = {
  option: OPTION, amountRaw: '2500000', account: ACCOUNT, fiatTotal: 16000,
  currency: 'NGN', rate: 1600, acceptHours: 24, paymentWindowSeconds: 21600, // 6h
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW_MS)
  mockCreate.mockReset().mockResolvedValue({ escrow_id: 'e1', unsigned: { kind: 'evm-tx' } })
  mockExchangeCreate.mockReset().mockResolvedValue({})
  mockDelete.mockClear()
  mockSign.mockClear()
  mockReplace.mockReset()
  mockPush.mockReset()
  mockToast.mockReset()
  mockGate = null
})
afterEach(() => jest.restoreAllMocks())

test('threads the chosen windows into escrow + offer creation and signs', async () => {
  const { result } = renderHook(() => useOfferSell())
  await act(async () => { await result.current.submit(ARGS) })

  expect(mockCreate).toHaveBeenCalledWith({
    kind: 'exchange', chain_id: 'eip155:84532', asset: 'USDC_BASE', amount_raw: '2500000',
    accept_deadline_unix: NOW_S + 24 * 3600,
    completion_duration_seconds: 21600,
  })
  expect(mockExchangeCreate).toHaveBeenCalledWith({
    escrow_id: 'e1', fiat_amount: 16000, fiat_currency: 'NGN', rate: 1600,
    payment_window_seconds: 21600, payout_account_id: 'acc1',
  })
  expect(mockSign).toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith('/exchange/e1')
})

test('discards the draft when attaching offer terms fails', async () => {
  mockExchangeCreate.mockRejectedValue(new Error('bad rate'))
  const { result } = renderHook(() => useOfferSell())
  await act(async () => { await result.current.submit(ARGS) })

  expect(mockDelete).toHaveBeenCalledWith({ id: 'e1' })
  expect(mockSign).not.toHaveBeenCalled()
  expect(mockToast).toHaveBeenCalledWith('error', expect.any(String))
})

test('routes to the transaction gate when create is gated (9D)', async () => {
  mockCreate.mockRejectedValue(new Error('gated'))
  mockGate = 'link_wallet'
  const { result } = renderHook(() => useOfferSell())
  await act(async () => { await result.current.submit(ARGS) })

  expect(mockPush).toHaveBeenCalledWith('/settings/linked-wallets')
  expect(mockReplace).not.toHaveBeenCalled()
})

test('surfaces the API error message when create fails ungated', async () => {
  mockCreate.mockRejectedValue(new ApiClientError(409, 'Conflict', 'offer limit reached'))
  const { result } = renderHook(() => useOfferSell())
  await act(async () => { await result.current.submit(ARGS) })
  expect(mockToast).toHaveBeenCalledWith('error', 'offer limit reached')
  expect(mockReplace).not.toHaveBeenCalled()
})

test('keeps the draft when signing is declined after terms are saved', async () => {
  mockSign.mockRejectedValue(new Error('user declined'))
  const { result } = renderHook(() => useOfferSell())
  await act(async () => { await result.current.submit(ARGS) })

  expect(mockDelete).not.toHaveBeenCalled() // terms saved, draft survives
  expect(mockToast).toHaveBeenCalledWith('info', 'user declined')
  expect(mockReplace).toHaveBeenCalledWith('/exchange/e1')
})
