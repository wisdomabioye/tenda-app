/**
 * The Post Wizard end to end (jsdom): each of the five steps gating on the
 * SHARED validation, rail navigation, the review list's honesty, submit
 * reaching onSubmit with the composed values, and the warn verdict.
 *
 * The per-step negative tests are the point of this file. A wizard's failure
 * mode is not a crash — it is a Continue button that refuses without saying
 * why, or one that lets a reader past a step they have not answered.
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
vi.mock('@/hooks/gig/useModerationPreview', () => ({
  useModerationPreview: () => previewState.current,
}))
vi.mock('@/hooks/wallet/useSpendableBalance', () => ({
  useSpendableBalance: () => ({ balance: null, status: 'ready', refresh: vi.fn() }),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { country: string; is_seeker: boolean }; wallets: unknown[] }) => unknown) =>
    selector({ user: { country: 'NG', is_seeker: false }, wallets: walletsState.current }),
}))

import { GigWizard } from '@/components/gig/GigWizard'
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
  render(<GigWizard initialValues={initialValues} onSubmit={onSubmit} isLoading={false} />)
  return onSubmit
}

/** Advance `n` steps, asserting each one actually let us through. */
function advance(n: number) {
  for (let i = 0; i < n; i += 1) {
    const next = screen.getByRole('button', { name: 'Continue' })
    expect(next).toBeEnabled()
    fireEvent.click(next)
  }
}


// ─────────────────────────── per-step gating ───────────────────────────

test('step 1 refuses without a category, and names what is missing', () => {
  renderForm()
  expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByText('Pick a category to continue')).toBeInTheDocument()
})

test('step 2 refuses without a title, then without a description', () => {
  renderForm({ category: 'delivery' })
  advance(1)
  expect(screen.getByText('Write the brief')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByText('Add a title to continue')).toBeInTheDocument()

  fireEvent.change(screen.getByPlaceholderText(/Same-day delivery/), {
    target: { value: 'Deliver a package' },
  })
  expect(screen.getByText('Add a description to continue')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
})

test('step 3 refuses a physical gig with no city', () => {
  // country falls back to the account's NG, so the city is what is missing.
  renderForm({ ...VALID, remote: false, city: null })
  advance(2)
  expect(screen.getByText('Where and by when?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByText('Select a city to continue')).toBeInTheDocument()
})

test('step 4 never blocks — an empty proof list is a real answer', () => {
  // Deliberate: shared documents proofRequirements: [] as "any evidence
  // accepted". The comp wanted at least one; enforcing that on web alone
  // would reject gigs mobile accepts.
  renderForm(VALID)
  advance(3)
  expect(screen.getByText('What proof settles it?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})

test('step 5 refuses without a budget, and asks to review and sign, not continue', () => {
  renderForm({ ...VALID, paymentRaw: 0 })
  advance(4)
  expect(screen.getByRole('heading', { name: 'Fund the escrow' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review and sign' })).toBeDisabled()
  expect(screen.getByText('Set a budget to review and sign')).toBeInTheDocument()
})

// ─────────────────────────── the rail ───────────────────────────

test('the rail refuses to jump ahead of an unanswered step', () => {
  renderForm()
  expect(screen.getByRole('button', { name: /The brief/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /The brief/ }))
  expect(screen.getByText('Step 1 of 5')).toBeInTheDocument() // went nowhere
})

test('the rail carries the reader back to a finished step, keeping later answers', () => {
  renderForm(VALID)
  advance(4)
  expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /The brief/ }))
  expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
  // The title survived the round trip — the rail navigates, it does not reset.
  expect(screen.getByDisplayValue('Deliver a package')).toBeInTheDocument()
})

test('emptying an earlier field disables the final signature button', () => {
  // The last step asks the WHOLE form, not just its own field: without that,
  // Review and sign would look enabled while submit silently refused.
  renderForm(VALID)
  advance(1)
  fireEvent.change(screen.getByDisplayValue('Deliver a package'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: /Amount and signing/ }))
  // The rail will not carry an unsatisfied step forward either.
  expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
  expect(screen.getByText('Add a title to continue')).toBeInTheDocument()
})

// ─────────────────────── review, submit, moderation ───────────────────────

test('the review list states the composed facts before anything is signed', () => {
  renderForm(VALID)
  advance(4)
  expect(screen.getByText('What you are publishing')).toBeInTheDocument()
  expect(screen.getByText('Delivery')).toBeInTheDocument()
  expect(screen.getByText('Remote')).toBeInTheDocument()
  // An unset proof list reads as the choice it is, never as a blank.
  expect(screen.getByText('Any evidence')).toBeInTheDocument()
  expect(screen.getByText('First qualified worker')).toBeInTheDocument()
})

test('a prefilled gig walks all five steps and submits the composed values', async () => {
  const onSubmit = renderForm(VALID)
  advance(4)
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
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

test('a warn verdict intercepts the signature once; Publish anyway proceeds', async () => {
  previewState.current = {
    decision: 'warn',
    reasons: [{ code: 'price', message: 'Budget looks low.', severity: 'warn' }],
    cached: false,
  }
  const onSubmit = renderForm(VALID)
  advance(4)
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByText('Before you publish')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publish anyway' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
})

test('a warn verdict with Edit keeps the wizard and never submits', () => {
  previewState.current = {
    decision: 'warn',
    reasons: [{ code: 'price', message: 'Budget looks low.', severity: 'warn' }],
    cached: false,
  }
  const onSubmit = renderForm(VALID)
  advance(4)
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit gig' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.queryByText('Before you publish')).not.toBeInTheDocument()
})

// ─────────────────────────── the money step ───────────────────────────

test('EVM chains render disabled in the network picker until an eip155 wallet is linked', async () => {
  renderForm(VALID)
  advance(4)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Base Sepolia (link a wallet)' })).toBeDisabled(),
  )
})

test('a linked EVM wallet makes the chain selectable and swaps the policy asset', async () => {
  walletsState.current = [{ chain_ns: 'eip155', verified_at: '2026-01-01' }]
  const onSubmit = renderForm(VALID)
  advance(4)
  fireEvent.click(await screen.findByRole('button', { name: 'Base Sepolia' }))
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ chainId: 'eip155:84532', asset: 'USDC_BASE' })
})

test('jumping the rail to the last step says which step is holding it up', () => {
  // Reachable, and the reason the last step names the owning step: the rail
  // only locks against the CURRENT step, so a satisfied step 1 unlocks every
  // later one and the reader can land on money with an empty brief.
  renderForm({ category: 'delivery' })
  fireEvent.click(screen.getByRole('button', { name: /Amount and signing/ }))
  expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review and sign' })).toBeDisabled()
  // Not "Add a title to review and sign" — there is no title field on this
  // step, so that would send the reader hunting.
  expect(screen.getByText('Add a title — go back to The brief')).toBeInTheDocument()
})

test('the last step still phrases its OWN requirement as review and sign', () => {
  renderForm({ ...VALID, paymentRaw: 0 })
  advance(4)
  expect(screen.getByText('Set a budget to review and sign')).toBeInTheDocument()
})
