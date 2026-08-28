/**
 * useGigForm (web) — the proof-param half of the controller: the editor draft
 * is rebuilt from a reposted draft gig, the shared validation gates the form
 * on it, and submit derives the pin + params for the SELECTED types only
 * (editor residue for a deselected type never reaches the wire).
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const { chainsMock } = vi.hoisted(() => ({ chainsMock: vi.fn() }))
vi.mock('@/api/client', () => ({
  api: { platform: { chains: (...a: unknown[]) => chainsMock(...a) } },
}))
vi.mock('@/hooks/gig/useModerationPreview', () => ({ useModerationPreview: () => null }))
vi.mock('@/lib/browser-country', () => ({ getBrowserCountry: () => 'NG' }))
vi.mock('@/wallet/config', () => ({ SOLANA_NETWORK: 'devnet' }))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (
    selector: (s: { user: { country: string }; wallets: unknown[]; ensureWallets: () => Promise<void> }) => unknown,
  ) => selector({ user: { country: 'NG' }, wallets: [], ensureWallets: async () => {} }),
}))

import { useGigForm } from '@/hooks/gig/useGigForm'

beforeEach(() => {
  vi.clearAllMocks()
  chainsMock.mockResolvedValue({ data: [] })
})

test('rebuilds the proof-param draft from a reposted draft gig — pin, radius and fields', () => {
  const { result } = renderHook(() =>
    useGigForm(
      {
        proofRequirements: ['geotag', 'structured'],
        latitude: 6.5244,
        longitude: 3.3792,
        proofParams: {
          geotag: { radius_m: 120 },
          structured: { fields: [{ name: 'count', kind: 'number', required: true }] },
        },
      },
      vi.fn(),
    ),
  )
  expect(result.current.proofDraft).toEqual({
    pin: { latitude: 6.5244, longitude: 3.3792 },
    radiusText: '120',
    fields: [{ name: 'count', kind: 'number', required: true }],
  })
})

test('a geotag requirement without its pin blocks the form through the SHARED rule', () => {
  const { result } = renderHook(() =>
    useGigForm(
      { category: 'delivery', title: 'Deliver', description: 'x', city: 'Lagos', paymentRaw: '10000000' },
      vi.fn(),
    ),
  )
  act(() => result.current.setProofRequirements(['geotag']))
  expect(result.current.missingRequirement).toBe('Set the check-in point for the location proof')
  act(() =>
    result.current.setProofDraft({ ...result.current.proofDraft, pin: { latitude: 1, longitude: 2 } }),
  )
  expect(result.current.missingRequirement).toBeNull()
})

test('submits the pin + params for the SELECTED types only — and nothing when none is selected', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() =>
    useGigForm(
      { category: 'delivery', title: 'Deliver', description: 'x', remote: true, paymentRaw: '10000000' },
      onSubmit,
    ),
  )
  act(() =>
    result.current.setProofDraft({ ...result.current.proofDraft, pin: { latitude: 1, longitude: 2 } }),
  )
  await act(async () => {
    await result.current.submitValues()
  })
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitude: null, longitude: null, proofParams: null }),
  )

  act(() => {
    result.current.setIsRemote(false)
    result.current.setSelectedCity('Lagos')
    result.current.setProofRequirements(['geotag'])
  })
  await act(async () => {
    await result.current.submitValues()
  })
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitude: 1, longitude: 2, proofParams: { geotag: { radius_m: 500 } } }),
  )
})
