import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'
import { makeUser } from '../../../test/factories/user'
import CreateOfferPage from '@/components/exchange/CreateOfferPage'
import { useAuthStore } from '@/stores/auth.store'

const dependencies = vi.hoisted(() => ({
  bankAccounts: vi.fn(),
  assetOptions: vi.fn<() => ExchangeAssetOption[]>(() => []),
}))

vi.mock('@/api/client', () => ({ api: { fiat: { bankAccounts: dependencies.bankAccounts } } }))
vi.mock('@/hooks/exchange/useExchangeAssetOptions', () => ({
  useExchangeAssetOptions: dependencies.assetOptions,
}))
vi.mock('@/hooks/exchange/useOfferSell', () => ({
  useOfferSell: () => ({ submit: vi.fn(), submitting: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  dependencies.assetOptions.mockReturnValue([])
  useAuthStore.setState({ user: makeUser({ advanced_mode_enabled: false }) })
})

it('refuses a partially numeric rate instead of silently posting its numeric prefix', async () => {
  useAuthStore.setState({ user: makeUser({ advanced_mode_enabled: true }) })
  dependencies.assetOptions.mockReturnValue([
    {
      chainId: 'solana:devnet',
      assetId: 'USDC_SOL',
      symbol: 'USDC',
      decimals: 6,
      chainName: 'Solana Devnet',
      walletAddress: 'wallet-1',
    },
  ])
  dependencies.bankAccounts.mockResolvedValue([
    {
      id: 'bank-1',
      country: 'NG',
      kind: 'bank',
      bank_code: '001',
      account_number_masked: '•• 1234',
      account_name: 'Ada',
      is_default: true,
      verified: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ])
  render(<CreateOfferPage />)
  await userEvent.type(screen.getByLabelText('Amount to sell'), '10')
  await userEvent.type(screen.getByLabelText(/Your rate/), '5oops')
  expect(await screen.findByRole('button', { name: 'Set your rate' })).toBeDisabled()
})

it('locks offer creation without fetching private composer dependencies', () => {
  render(<CreateOfferPage />)
  expect(screen.getByText('Offer creation is locked')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings')
  expect(dependencies.assetOptions).not.toHaveBeenCalled()
  expect(dependencies.bankAccounts).not.toHaveBeenCalled()
})
