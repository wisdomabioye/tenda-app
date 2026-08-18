/**
 * The Post Wizard's back half: what it publishes, what it submits, and what a
 * moderation verdict does to the signature — plus the money step's network
 * policy. The step gating and the rail live in GigWizard.test.tsx; the two
 * were split to stay inside the 300-line limit.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { GigFormValues, ModerationPreviewResponse } from '@tenda/shared'

// These two suites drive the whole five-step wizard: each `advance()` renders
// a fresh step with its pickers, and the money step mounts FeeSummary. That is
// 2–3s of real work uninstrumented and 6s+ under v8 coverage, which crosses
// vitest's 5s default and made the run flaky — two tests timed out in one
// coverage run and passed in the next three. Raised HERE rather than globally:
// a global bump would hide a unit test that genuinely got slow.
vi.setConfig({ testTimeout: 20_000 })

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
import { EVM_CHAIN, SOL_CHAIN, VALID } from '../__fixtures__/wizard-fixtures'


beforeEach(() => {
  chainsMock.mockResolvedValue({ data: [SOL_CHAIN, EVM_CHAIN] })
  previewState.current = null
  walletsState.current = []
  usePlatformConfigStore.setState({ config: null, loading: false, error: null })
})


async function renderForm(
  initialValues?: Partial<GigFormValues>,
  onSubmit = vi.fn<(values: GigFormValues) => Promise<void>>(async () => {}),
) {
  render(<GigWizard initialValues={initialValues} onSubmit={onSubmit} isLoading={false} />)
  // The controller fetches the chain registry on mount and sets state when it
  // lands. Without flushing that here every assertion below races it, and the
  // update arrives outside act() — 35 warnings a run, and any of them could
  // settle during a LATER test.
  await act(async () => {})
  return onSubmit
}

/** Advance `n` steps, asserting each one actually let us through. */
async function advance(n: number) {
  for (let i = 0; i < n; i += 1) {
    const next = screen.getByRole('button', { name: 'Continue' })
    expect(next).toBeEnabled()
    fireEvent.click(next)
  }
  // The money step mounts FeeSummary, which asks the platform-config store for
  // the fee tier — another mount-time async update to settle inside act().
  await act(async () => {})
}

// ─────────────────────── review, submit, moderation ───────────────────────

test('the review list states the composed facts before anything is signed', async () => {
  await renderForm(VALID)
  await advance(4)
  expect(screen.getByText('What you are publishing')).toBeInTheDocument()
  expect(screen.getByText('Delivery')).toBeInTheDocument()
  expect(screen.getByText('Remote')).toBeInTheDocument()
  // An unset proof list reads as the choice it is, never as a blank.
  expect(screen.getByText('Any evidence')).toBeInTheDocument()
  expect(screen.getByText('First qualified worker')).toBeInTheDocument()
})

test('a prefilled gig walks all five steps and submits the composed values', async () => {
  const onSubmit = await renderForm(VALID)
  await advance(4)
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
  const onSubmit = await renderForm(VALID)
  await advance(4)
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByText('Before you publish')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publish anyway' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
})

test('a warn verdict with Edit keeps the wizard and never submits', async () => {
  previewState.current = {
    decision: 'warn',
    reasons: [{ code: 'price', message: 'Budget looks low.', severity: 'warn' }],
    cached: false,
  }
  const onSubmit = await renderForm(VALID)
  await advance(4)
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit gig' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.queryByText('Before you publish')).not.toBeInTheDocument()
})

// ─────────────────────────── the money step ───────────────────────────

test('EVM chains render disabled in the network picker until an eip155 wallet is linked', async () => {
  await renderForm(VALID)
  await advance(4)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Base Sepolia (link a wallet)' })).toBeDisabled(),
  )
})

test('a linked EVM wallet makes the chain selectable and swaps the policy asset', async () => {
  walletsState.current = [{ chain_ns: 'eip155', verified_at: '2026-01-01' }]
  const onSubmit = await renderForm(VALID)
  await advance(4)
  fireEvent.click(await screen.findByRole('button', { name: 'Base Sepolia' }))
  fireEvent.click(screen.getByRole('button', { name: 'Review and sign' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ chainId: 'eip155:84532', asset: 'USDC_BASE' })
})

test('jumping the rail to the last step says which step is holding it up', async () => {
  // Reachable, and the reason the last step names the owning step: the rail
  // only locks against the CURRENT step, so a satisfied step 1 unlocks every
  // later one and the reader can land on money with an empty brief.
  await renderForm({ category: 'delivery' })
  fireEvent.click(screen.getByRole('button', { name: /Amount and signing/ }))
  expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review and sign' })).toBeDisabled()
  // Not "Add a title to review and sign" — there is no title field on this
  // step, so that would send the reader hunting.
  expect(screen.getByText('Add a title — go back to The brief')).toBeInTheDocument()
})

test('the last step still phrases its OWN requirement as review and sign', async () => {
  await renderForm({ ...VALID, paymentRaw: 0 })
  await advance(4)
  expect(screen.getByText('Set a budget to review and sign')).toBeInTheDocument()
})

test('the final-step hint never names a requirement the step it points at does not own', async () => {
  // Reachable: DurationPicker's custom path does not clamp, so 91 days is an
  // invalid completion window. Land on money with BOTH that and no budget.
  //
  // The two halves of this sentence used to come from different orderings —
  // the requirement from mobile's 3-step order (budget before duration), the
  // step from the wizard's 5-step order (duration on Where and when) — which
  // produced "Set a budget — go back to Where and when". Where and when has
  // no budget field.
  await renderForm({ ...VALID, completionDuration: 91 * 86_400, paymentRaw: 0 })
  fireEvent.click(screen.getByRole('button', { name: /Amount and signing/ }))
  expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
  expect(screen.getByText('Set a delivery time — go back to Where and when')).toBeInTheDocument()
  expect(screen.queryByText(/Set a budget — go back/)).not.toBeInTheDocument()
})

test('the brief fields are named by their label alone, not by their hint and counter', async () => {
  // The label used to WRAP the input, the hint and the live counter, so the
  // accessible name was "TitleSay what, where and when…7/80" — and it changed
  // on every keystroke, which is what a screen reader would re-announce.
  await renderForm({ category: 'delivery' })
  await advance(1)
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'The brief' })).toBeInTheDocument()
})

test('names the raw chain when the registry could not be read', async () => {
  // useGigForm catches a failed registry fetch and keeps going with no chain
  // options, so the review has no display name to show. It falls back to the
  // CAIP id rather than rendering an empty "Settles on" row.
  chainsMock.mockRejectedValue(new Error('registry down'))
  await renderForm(VALID)
  await advance(4)
  expect(screen.getByText('solana:devnet')).toBeInTheDocument()
})
