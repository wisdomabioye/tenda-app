/**
 * The offer-creation orchestration: draft → terms → sign in ORDER with
 * one idempotent operation id; a terms failure DISCARDS the bare draft; a
 * signing decline leaves the draft alive and routes to its page.
 */
import { renderHook, act } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { BankAccountSummary } from '@tenda/shared'

const routerReplace = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => ({
  escrows: {
    create: vi.fn<() => Promise<{ escrow_id: string; unsigned: { kind: string } }>>(),
    delete: vi.fn<() => Promise<{ deleted: true }>>(),
  },
  exchange: { create: vi.fn<() => Promise<{ escrow_id: string }>>() },
}))
const signSendAndReport = vi.hoisted(() => vi.fn<() => Promise<void>>())
const ensureSufficientBalance = vi.hoisted(() => vi.fn<() => Promise<void>>())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, back: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/wallet/dispatch', () => ({
  resolveSignersForChain: () => ['SoLAddr1'],
  signSendAndReport,
}))
vi.mock('@/wallet/balances', () => ({ ensureSufficientBalance }))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/Toast', () => ({ showToast: toastMock }))

import { useOfferSell, type OfferSubmitArgs } from '@/hooks/exchange/useOfferSell'

const ACCOUNT: BankAccountSummary = {
  id: 'acct-1',
  country: 'NG',
  kind: 'bank',
  bank_code: '058',
  account_number_masked: '******6789',
  account_name: 'Ada Okafor',
  is_default: true,
  verified: true,
  created_at: '2026-08-01T00:00:00.000Z',
}

const ARGS: OfferSubmitArgs = {
  option: {
    chainId: 'solana:devnet',
    assetId: 'USDC_SOL',
    symbol: 'USDC',
    decimals: 6,
    chainName: 'Solana Devnet',
    walletAddress: 'SoLAddr1',
  },
  amountRaw: '50000000',
  account: ACCOUNT,
  fiatTotal: 75000,
  currency: 'NGN',
  rate: 1500,
  acceptHours: 24,
  paymentWindowSeconds: 3600,
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureSufficientBalance.mockResolvedValue()
  apiMock.escrows.create.mockResolvedValue({ escrow_id: 'new-exch', unsigned: { kind: 'solana-tx' } })
  apiMock.exchange.create.mockResolvedValue({ escrow_id: 'new-exch' })
  apiMock.escrows.delete.mockResolvedValue({ deleted: true })
  signSendAndReport.mockResolvedValue()
})

test('happy path: balance gate → draft → terms → sign, then lands on the offer', async () => {
  const { result } = renderHook(() => useOfferSell())
  await act(() => result.current.submit(ARGS))

  expect(ensureSufficientBalance).toHaveBeenCalledWith(
    expect.objectContaining({ chainId: 'solana:devnet', amountRaw: '50000000' }),
  )
  expect(apiMock.escrows.create).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'exchange',
      completion_duration_seconds: 3600, // the ONE payment-window semantic
    }),
  )
  expect(apiMock.exchange.create).toHaveBeenCalledWith(
    expect.objectContaining({
      escrow_id: 'new-exch',
      payment_window_seconds: 3600,
      payout_account_id: 'acct-1',
    }),
  )
  expect(signSendAndReport).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }))
  expect(routerReplace).toHaveBeenCalledWith('/exchange/new-exch')
})

test('a terms failure DISCARDS the bare draft (never an unfundable orphan)', async () => {
  apiMock.exchange.create.mockRejectedValue(new Error('bad terms'))
  const { result } = renderHook(() => useOfferSell())
  await act(() => result.current.submit(ARGS))

  expect(apiMock.escrows.delete).toHaveBeenCalledWith({ id: 'new-exch' })
  expect(signSendAndReport).not.toHaveBeenCalled()
  expect(routerReplace).not.toHaveBeenCalled()
})

test('a signing decline leaves the draft alive and routes to its page', async () => {
  signSendAndReport.mockRejectedValue(new Error('user declined'))
  const { result } = renderHook(() => useOfferSell())
  await act(() => result.current.submit(ARGS))

  expect(apiMock.escrows.delete).not.toHaveBeenCalled() // draft survives
  // Mobile-aligned copy: an INFO toast carrying the wallet's own message.
  expect(toastMock).toHaveBeenCalledWith('info', 'user declined')
  expect(routerReplace).toHaveBeenCalledWith('/exchange/new-exch')
})

test('concurrent submits collapse to ONE order (double-click ≠ two drafts)', async () => {
  const { result } = renderHook(() => useOfferSell())
  await act(async () => {
    // Fire the second submit while the first is still in flight.
    await Promise.all([result.current.submit(ARGS), result.current.submit(ARGS)])
  })
  expect(apiMock.escrows.create).toHaveBeenCalledTimes(1)
  expect(signSendAndReport).toHaveBeenCalledTimes(1)
  expect(result.current.submitting).toBe(false) // and the flag resets after
})

test('an insufficient balance stops before any server write', async () => {
  const { InsufficientBalanceError } = await import('@tenda/shared')
  ensureSufficientBalance.mockRejectedValue(new InsufficientBalanceError('USDC_SOL', '50000000', '1000000'))
  const { result } = renderHook(() => useOfferSell())
  await act(() => result.current.submit(ARGS))

  expect(apiMock.escrows.create).not.toHaveBeenCalled()
})
