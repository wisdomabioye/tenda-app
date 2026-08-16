/**
 * The composer wizard end to end (jsdom): step gating on the shared
 * validation, navigation, the review step's honesty, submit reaching
 * onSubmit with the composed values, and the warn-verdict interception.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { GigFormValues, ModerationPreviewResponse } from '@tenda/shared'

const { chainsMock, previewState, walletsState } = vi.hoisted(() => ({
  chainsMock: vi.fn(),
  previewState: { current: null as ModerationPreviewResponse | null },
  walletsState: { current: [] as { chain_ns: string; verified_at: string | null }[] },
}))

vi.mock('@/api/client', () => ({
  api: {
    platform: {
      chains: (...a: unknown[]) => chainsMock(...a),
      config: vi.fn(async () => ({ fee_bps: 250, seeker_fee_bps: 100 })),
    },
  },
}))
vi.mock('@/hooks/useModerationPreview', () => ({
  useModerationPreview: () => previewState.current,
}))
vi.mock('@/hooks/useSpendableBalance', () => ({
  useSpendableBalance: () => ({ balance: null, status: 'ready', refresh: vi.fn() }),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { country: string; is_seeker: boolean }; wallets: unknown[] }) => unknown) =>
    selector({ user: { country: 'NG', is_seeker: false }, wallets: walletsState.current }),
}))

import { GigForm } from '@/components/gig/GigForm'
import { usePlatformConfigStore } from '@/stores/platform-config.store'

const SOL_CHAIN = {
  id: 'solana:devnet',
  namespace: 'solana',
  display_name: 'Solana',
  escrow_address: 'PROG',
  assets: [{ id: 'USDC_SOL', symbol: 'USDC', decimals: 6, is_stable: true, token_address: 'MINT', supports_permit: false }],
}
const EVM_CHAIN = {
  id: 'eip155:84532',
  namespace: 'eip155',
  display_name: 'Base Sepolia',
  escrow_address: '0xE',
  assets: [{ id: 'USDC_BASE', symbol: 'USDC', decimals: 6, is_stable: true, token_address: '0xT', supports_permit: true }],
}

beforeEach(() => {
  chainsMock.mockResolvedValue({ data: [SOL_CHAIN, EVM_CHAIN] })
  previewState.current = null
  walletsState.current = []
  usePlatformConfigStore.setState({ config: null, loading: false, error: null })
})

const VALID: Partial<GigFormValues> = {
  title: 'Deliver a package',
  description: 'Collect and deliver safely.',
  category: 'delivery',
  remote: true,
  paymentRaw: 10_000_000,
}

function renderForm(
  initialValues?: Partial<GigFormValues>,
  onSubmit = vi.fn<(values: GigFormValues) => Promise<void>>(async () => {}),
) {
  render(<GigForm initialValues={initialValues} onSubmit={onSubmit} submitLabel="Post Gig" isLoading={false} />)
  return onSubmit
}

test('the details step gates Continue on the first actionable requirement', () => {
  renderForm()
  const continueBtn = screen.getByRole('button', { name: 'Continue' })
  expect(continueBtn).toBeDisabled()
  expect(screen.getByText('Pick a category to continue')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }))
  expect(screen.getByText('Add a title to continue')).toBeInTheDocument()
})

test('a prefilled valid form walks details → payment → delivery and submits', async () => {
  const onSubmit = renderForm(VALID)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → payment
  expect(screen.getByText('Set payment and timing')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → delivery
  expect(screen.getByText('Define delivery')).toBeInTheDocument()
  // The review card states the composed facts.
  expect(screen.getByText('Deliver a package')).toBeInTheDocument()
  expect(screen.getByText('Remote')).toBeInTheDocument()
  expect(screen.getByText('10 USDC')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Post Gig' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    title: 'Deliver a package',
    chainId: 'solana:devnet',
    asset: 'USDC_SOL',
    paymentRaw: 10_000_000,
    remote: true,
    country: null, // remote gigs carry no location
    city: null,
    requiresApproval: false,
  })
})

test('a warn verdict intercepts submit once; Publish anyway proceeds', async () => {
  previewState.current = {
    decision: 'warn',
    reasons: [{ code: 'price', message: 'Budget looks low.', severity: 'warn' }],
    cached: false,
  }
  const onSubmit = renderForm(VALID)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Post Gig' }))
  // Intercepted — not submitted yet.
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByText('Before you publish')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publish anyway' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
})

test('a warn verdict with Edit keeps the form and never submits', () => {
  previewState.current = {
    decision: 'warn',
    reasons: [{ code: 'price', message: 'Budget looks low.', severity: 'warn' }],
    cached: false,
  }
  const onSubmit = renderForm(VALID)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Post Gig' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit gig' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.queryByText('Before you publish')).not.toBeInTheDocument()
})

test('EVM chains render disabled in the network picker until an eip155 wallet is linked', async () => {
  renderForm(VALID)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → payment
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Base Sepolia (link a wallet)' })).toBeDisabled(),
  )
})

test('a linked EVM wallet makes the chain selectable and swaps the policy asset', async () => {
  walletsState.current = [{ chain_ns: 'eip155', verified_at: '2026-01-01' }]
  const onSubmit = renderForm(VALID)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  const evmChip = await screen.findByRole('button', { name: 'Base Sepolia' })
  fireEvent.click(evmChip)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Post Gig' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ chainId: 'eip155:84532', asset: 'USDC_BASE' })
})
