/**
 * The claim hook (#53c-2): what it fetches, what it re-reads, and what a
 * failure does.
 *
 * The property with teeth is the re-read after a claim. The hook must not patch
 * its own state to "in_progress" — the server owns that answer, and a local
 * guess is what would let the card say "on its way" for a claim the server
 * refused, or offer a second claim after an idempotent one.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { ApiClientError } from '@tenda/shared'
import type { GasSeedAvailability } from '@tenda/shared'
import { useGasClaim, gasClaimForChain } from '../useGasClaim'
import { GAS_CLAIM_COPY } from '../copy'

// `mock`-prefixed on purpose: jest hoists `jest.mock` above every `const` in
// the file, and only names matching /^mock/ may be referenced from the factory.
// Without the prefix this suite fails to run at all, with an "allowed objects"
// error that names everything except the actual problem.
const mockAvailability = jest.fn()
const mockClaim = jest.fn()

jest.mock('@/api/client', () => ({
  api: {
    wallet: {
      gasSeedAvailability: () => mockAvailability(),
      claimGasSeed: (body: unknown) => mockClaim(body),
    },
  },
}))

function offer(over: Partial<GasSeedAvailability> = {}): GasSeedAvailability {
  return {
    chain_id: 'eip155:16661',
    available: true,
    amount_raw: '10000000000000000',
    state: 'unclaimed',
    reason: null,
    ...over,
  }
}

beforeEach(() => {
  mockAvailability.mockReset()
  mockClaim.mockReset()
})

it('reads availability once on mount and reports the chains', async () => {
  mockAvailability.mockResolvedValue({ chains: [offer()] })
  const { result } = renderHook(() => useGasClaim())

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.chains).toHaveLength(1)
  expect(mockAvailability).toHaveBeenCalledTimes(1)
})

it('a failed availability read renders NOTHING rather than an error', async () => {
  // This is an offer on a screen about balances. A user who cannot be told
  // about a grant has lost nothing; an error banner about it would be noise
  // over the thing they actually came for.
  mockAvailability.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useGasClaim())

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.chains).toEqual([])
  expect(result.current.error).toBeNull()
})

it('a claim RE-READS from the server instead of guessing the new state', async () => {
  // The server decides. A local `setState('in_progress')` would be a second
  // source of truth, and the one that is wrong when the claim was refused.
  mockAvailability
    .mockResolvedValueOnce({ chains: [offer()] })
    .mockResolvedValueOnce({ chains: [offer({ available: false, state: 'in_progress', reason: 'already_granted' })] })
  mockClaim.mockResolvedValue({ chain_id: 'eip155:16661', state: 'in_progress', amount_raw: '1', queued: true })

  const { result } = renderHook(() => useGasClaim())
  await waitFor(() => expect(result.current.loading).toBe(false))

  await act(async () => {
    await result.current.claim('eip155:16661')
  })

  expect(mockClaim).toHaveBeenCalledWith({ chain_id: 'eip155:16661' })
  expect(mockAvailability).toHaveBeenCalledTimes(2)
  expect(result.current.chains[0]?.state).toBe('in_progress')
  expect(result.current.chains[0]?.available).toBe(false)
})

it("a refused claim surfaces the SERVER's message, which names the reason", async () => {
  // "Verify your phone number" is actionable; a generic failure sentence is
  // not, and the server already wrote the right one.
  mockAvailability.mockResolvedValue({ chains: [offer()] })
  mockClaim.mockRejectedValue(new ApiClientError(403, 'Forbidden', 'verify your phone number', 'PHONE_VERIFICATION_REQUIRED'))

  const { result } = renderHook(() => useGasClaim())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => {
    await result.current.claim('eip155:16661')
  })

  expect(result.current.error).toBe('verify your phone number')
  expect(result.current.claiming).toBeNull()
})

it('a failure with NO message still tells the user something', async () => {
  mockAvailability.mockResolvedValue({ chains: [offer()] })
  mockClaim.mockRejectedValue(new Error('socket hang up'))

  const { result } = renderHook(() => useGasClaim())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => {
    await result.current.claim('eip155:16661')
  })

  // Silence would be indistinguishable from a tap that never registered.
  expect(result.current.error).toBe(GAS_CLAIM_COPY.failed)
  expect(result.current.claiming).toBeNull()
})

describe('gasClaimForChain', () => {
  it('finds the chain, and answers null rather than undefined when absent', () => {
    const chains = [offer({ chain_id: 'solana:devnet' }), offer()]
    expect(gasClaimForChain(chains, 'solana:devnet')?.chain_id).toBe('solana:devnet')
    expect(gasClaimForChain(chains, 'eip155:8453')).toBeNull()
  })
})
