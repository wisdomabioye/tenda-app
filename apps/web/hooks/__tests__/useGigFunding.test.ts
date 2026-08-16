/**
 * useGigFunding (web) — port of mobile's suite: the balance pre-flight ahead
 * of the permit signature and the draft (the ordering IS the feature), the
 * moderation block, the 9D gate over the REAL shared classifier, draft
 * survival on declined signing, composer-reset contracts, and acceptance-
 * mode forwarding. Web divergences under test: router.replace('/post')
 * clears the draft param, and no notification-prompt store exists.
 */
import { act, renderHook, type RenderHookResult } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiClientError, TRANSACTION_GATE_MESSAGE, type GigFormValues } from '@tenda/shared'

const { mockPush, mockReplace, mockToast, mockSign, mockResolveSigners, mockEnsure, mockBuildPermitFor, mockEscrowCreate, mockEscrowDelete, mockGigCreate } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockToast: vi.fn(),
  mockSign: vi.fn(),
  mockResolveSigners: vi.fn(),
  mockEnsure: vi.fn(),
  mockBuildPermitFor: vi.fn(),
  mockEscrowCreate: vi.fn(),
  mockEscrowDelete: vi.fn(),
  mockGigCreate: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
vi.mock('@/components/ui/Toast', () => ({ showToast: (...a: unknown[]) => mockToast(...a) }))
vi.mock('@/wallet/dispatch', () => ({
  signSendAndReport: (...a: unknown[]) => mockSign(...a),
  resolveSignersForChain: (...a: unknown[]) => mockResolveSigners(...a),
}))
vi.mock('@/wallet/balances', () => ({
  ensureSufficientBalance: (...a: unknown[]) => mockEnsure(...a),
}))
vi.mock('@/wallet/permit', () => ({ buildPermitFor: (...a: unknown[]) => mockBuildPermitFor(...a) }))
vi.mock('@/api/client', () => ({
  api: {
    escrows: {
      create: (b: unknown) => mockEscrowCreate(b),
      delete: (b: unknown) => mockEscrowDelete(b),
    },
    gigs: { create: (b: unknown) => mockGigCreate(b) },
  },
}))

import { useGigFunding } from '@/hooks/useGigFunding'

const SIGNERS = ['SoLSigner', 'SoLSecond']
const VALUES: GigFormValues = {
  title: 'Fix my sink',
  description: 'leaky',
  chainId: 'solana:devnet',
  asset: 'USDC_SOL',
  paymentRaw: 10_000_000,
  completionDuration: 86_400,
  acceptDeadlineHours: 24,
  category: 'service',
  country: 'NG',
  remote: true,
  city: null,
  proofRequirements: [],
  requiresApproval: false,
}

type HookResult = RenderHookResult<ReturnType<typeof useGigFunding>, unknown>['result']

/** Drive the hook from confirm → funding, the screen's real sequence. */
async function fund(result: HookResult, values: GigFormValues = VALUES) {
  await act(async () => {
    result.current.setPendingValues(values)
  })
  await act(async () => {
    await result.current.runFunding()
  })
}

beforeEach(() => {
  mockSign.mockResolvedValue('sig-1')
  mockResolveSigners.mockReturnValue(SIGNERS)
  mockEnsure.mockResolvedValue(undefined)
  mockBuildPermitFor.mockResolvedValue(undefined)
  mockEscrowCreate.mockResolvedValue({ escrow_id: 'e1', unsigned: { kind: 'solana-tx' } })
  mockEscrowDelete.mockResolvedValue(undefined)
  mockGigCreate.mockResolvedValue({})
})

const ARGS = { resetForm: vi.fn() }

test('checks the budget against every candidate wallet before anything else', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  expect(mockEnsure).toHaveBeenCalledWith({
    chainId: 'solana:devnet',
    assetId: 'USDC_SOL',
    amountRaw: '10000000',
    owners: SIGNERS,
  })
})

test('a short balance costs the user NO permit signature and NO draft', async () => {
  mockEnsure.mockRejectedValue(new Error('You need 10 USDC but your wallet holds 2.5 USDC.'))
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  // The ordering that makes the check worth having.
  expect(mockBuildPermitFor).not.toHaveBeenCalled()
  expect(mockEscrowCreate).not.toHaveBeenCalled()
  expect(mockGigCreate).not.toHaveBeenCalled()
  expect(mockEscrowDelete).not.toHaveBeenCalled() // nothing to clean up
  expect(mockSign).not.toHaveBeenCalled()
  expect(mockToast).toHaveBeenCalledWith('error', 'You need 10 USDC but your wallet holds 2.5 USDC.')
  expect(result.current.phase).toBe('idle') // no stuck spinner, the form is usable
  expect(mockPush).not.toHaveBeenCalled() // stays on the form, budget still editable
})

test('a covered budget funds the gig end to end', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  expect(mockEscrowCreate).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'gig', chain_id: 'solana:devnet', asset: 'USDC_SOL', amount_raw: '10000000' }),
  )
  expect(mockGigCreate).toHaveBeenCalledWith(expect.objectContaining({ escrow_id: 'e1', title: 'Fix my sink' }))
  expect(mockSign).toHaveBeenCalled()
  expect(result.current.phase).toBe('confirming')
  expect(result.current.monitor).toEqual({ signature: 'sig-1', escrowId: 'e1', chainId: 'solana:devnet' })
})

test('an ambiguous create failure retries with the same operation and deadline', async () => {
  mockEscrowCreate
    .mockRejectedValueOnce(new Error('request timed out'))
    .mockResolvedValueOnce({ escrow_id: 'e1', unsigned: { kind: 'solana-tx' } })
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  await fund(result)
  expect(mockEscrowCreate).toHaveBeenCalledTimes(2)
  const first = mockEscrowCreate.mock.calls[0][0] as { creation_operation_id: string; accept_deadline_unix: number }
  const retry = mockEscrowCreate.mock.calls[1][0] as { creation_operation_id: string; accept_deadline_unix: number }
  expect(retry.creation_operation_id).toBe(first.creation_operation_id)
  expect(retry.accept_deadline_unix).toBe(first.accept_deadline_unix)
  expect(mockGigCreate).toHaveBeenCalledTimes(1)
})

test('the permit is signed only once the balance clears, for the full budget', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  expect(mockBuildPermitFor).toHaveBeenCalledWith({
    chain_id: 'solana:devnet',
    asset: 'USDC_SOL',
    value_raw: '10000000',
  })
})

test('a moderation block surfaces the dialog and discards the orphan draft', async () => {
  mockGigCreate.mockRejectedValue(
    new ApiClientError(422, 'Unprocessable Entity', 'This gig breaks our rules', 'CONTENT_MODERATED'),
  )
  const resetForm = vi.fn()
  const { result } = renderHook(() => useGigFunding({ resetForm }))
  await fund(result)
  expect(mockEscrowDelete).toHaveBeenCalledWith({ id: 'e1' })
  expect(result.current.blockedMessage).toBe('This gig breaks our rules')
  expect(mockSign).not.toHaveBeenCalled()
  // The composer stays intact — the dialog's "Edit" is worthless against a
  // blank form.
  expect(resetForm).not.toHaveBeenCalled()
  await act(async () => {
    result.current.dismissBlocked()
  })
  expect(result.current.blockedMessage).toBeNull()
})

test('the 9D gate routes instead of dead-ending (real shared classifier)', async () => {
  mockEscrowCreate.mockRejectedValue(
    new ApiClientError(403, 'Forbidden', 'no wallet on this chain', 'WALLET_REQUIRED'),
  )
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  expect(mockToast).toHaveBeenCalledWith('error', TRANSACTION_GATE_MESSAGE.wallet_required)
  expect(mockPush).toHaveBeenCalledWith('/settings/linked-wallets')
})

test('the contact gate routes to Sign-in & security', async () => {
  mockEscrowCreate.mockRejectedValue(
    new ApiClientError(403, 'Forbidden', 'no verified contact', 'CONTACT_REQUIRED'),
  )
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  expect(mockToast).toHaveBeenCalledWith('error', TRANSACTION_GATE_MESSAGE.contact_required)
  expect(mockPush).toHaveBeenCalledWith('/settings/security')
})

test('signing declined after the draft is saved keeps the draft and lands on it', async () => {
  mockSign.mockRejectedValue(new Error('user declined'))
  const resetForm = vi.fn()
  const { result } = renderHook(() => useGigFunding({ resetForm }))
  await fund(result)
  expect(mockEscrowDelete).not.toHaveBeenCalled()
  expect(mockToast).toHaveBeenCalledWith('info', 'user declined')
  expect(mockPush).toHaveBeenCalledWith('/gig/e1')
  // The composed values live on the server as a draft — blank the composer.
  expect(resetForm).toHaveBeenCalled()
})

test('a failed pre-flight leaves the composer intact', async () => {
  mockEnsure.mockRejectedValue(new Error('short'))
  const resetForm = vi.fn()
  const { result } = renderHook(() => useGigFunding({ resetForm }))
  await fund(result)
  expect(resetForm).not.toHaveBeenCalled()
})

test('reposting a draft discards the abandoned one once the new draft exists', async () => {
  const { result } = renderHook(() => useGigFunding({ draftId: 'old-draft', resetForm: vi.fn() }))
  await fund(result)
  expect(mockEscrowDelete).toHaveBeenCalledWith({ id: 'old-draft' })
})

test('a confirmed escrow clears the draft prefill and lands on the gig', async () => {
  const resetForm = vi.fn()
  const { result } = renderHook(() => useGigFunding({ draftId: 'old-draft', resetForm }))
  await fund(result)
  await act(async () => {
    result.current.handleFunded()
  })
  expect(resetForm).toHaveBeenCalled()
  // Web's draft-param clear: replace the URL without the ?draftId.
  expect(mockReplace).toHaveBeenCalledWith('/post')
  expect(mockToast).toHaveBeenCalledWith('success', 'Gig funded and live!')
  expect(mockPush).toHaveBeenCalledWith('/gig/e1')
  expect(result.current.phase).toBe('idle')
})

test('a funded gig without a draft never rewrites the URL', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  await act(async () => {
    result.current.handleFunded()
  })
  expect(mockReplace).not.toHaveBeenCalled()
})

test('a timeout still lands the user on the gig rather than trapping the modal', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result)
  await act(async () => {
    result.current.handleFundTimeout('')
  })
  expect(mockToast).toHaveBeenCalledWith('info', 'Submitted — it will go live once the escrow confirms.')
  expect(mockPush).toHaveBeenCalledWith('/gig/e1')
})

test('runFunding without confirmed values is a no-op', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await act(async () => {
    await result.current.runFunding()
  })
  expect(mockEnsure).not.toHaveBeenCalled()
  expect(mockEscrowCreate).not.toHaveBeenCalled()
})

test('approval mode is forwarded to the create body; instant mode sends NO flag', async () => {
  const { result } = renderHook(() => useGigFunding(ARGS))
  await fund(result, { ...VALUES, requiresApproval: true })
  expect(mockEscrowCreate).toHaveBeenCalledWith(expect.objectContaining({ requires_approval: true }))

  mockEscrowCreate.mockClear()
  await fund(result, { ...VALUES, requiresApproval: false })
  const [body] = mockEscrowCreate.mock.calls[0] as [Record<string, unknown>]
  // The server treats an absent flag as instant, so omitting it and sending
  // `false` mean the same thing — and the smaller body is the honest one.
  expect(body).not.toHaveProperty('requires_approval')
})
