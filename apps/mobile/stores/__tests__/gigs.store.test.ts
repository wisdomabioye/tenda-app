/**
 * The gig-detail store's single `selectedGig` slot.
 *
 * One slot serves every gig, so the interesting behaviour is what happens when
 * the id CHANGES: a gig left over from the previous screen must not stay
 * readable while a different one loads. Since approval mode that is not
 * cosmetic — the leftover carries the previous viewer's `viewer` block, i.e.
 * another user's Apply/Withdraw state.
 */
import { useGigsStore } from '../gigs.store'
import { gigDetail } from '@/components/gig/__fixtures__/gig-detail'

const mockGet = jest.fn()
const mockReview = jest.fn()
jest.mock('@/api/client', () => ({
  api: {
    gigs: { get: (...args: unknown[]) => mockGet(...args) },
    escrows: { review: (...args: unknown[]) => mockReview(...args) },
  },
}))

beforeEach(() => {
  useGigsStore.setState({ selectedGig: null, isLoading: false, error: null, errorId: null })
})

test('a successful load stores the gig and clears the loading flag', async () => {
  const gig = gigDetail({ escrow_id: 'gig-1' })
  mockGet.mockResolvedValue(gig)

  await useGigsStore.getState().fetchGigDetail('gig-1')

  expect(mockGet).toHaveBeenCalledWith({ id: 'gig-1' })
  expect(useGigsStore.getState().selectedGig).toEqual(gig)
  expect(useGigsStore.getState().isLoading).toBe(false)
  expect(useGigsStore.getState().error).toBeNull()
})

test('loading a DIFFERENT gig drops the previous one immediately', () => {
  useGigsStore.setState({ selectedGig: gigDetail({ escrow_id: 'gig-1' }) })
  // Never awaited: the point is the state BEFORE the response lands.
  mockGet.mockReturnValue(new Promise(() => {}))
  void useGigsStore.getState().fetchGigDetail('gig-2')

  expect(useGigsStore.getState().selectedGig).toBeNull()
  expect(useGigsStore.getState().isLoading).toBe(true)
})

test('re-loading the SAME gig keeps it on screen while it revalidates', () => {
  const gig = gigDetail({ escrow_id: 'gig-1' })
  useGigsStore.setState({ selectedGig: gig })
  mockGet.mockReturnValue(new Promise(() => {}))
  void useGigsStore.getState().fetchGigDetail('gig-1')

  // A pull-to-refresh must not blank the screen it is refreshing.
  expect(useGigsStore.getState().selectedGig).toEqual(gig)
})

test('a failure records WHICH gig it was for', async () => {
  mockGet.mockRejectedValue(new Error('Network request failed'))

  await useGigsStore.getState().fetchGigDetail('gig-1')

  expect(useGigsStore.getState().error).toBe('Network request failed')
  // `error` alone cannot say which gig failed, and one slot serves them all —
  // without the id, opening any other gig would show this failure.
  expect(useGigsStore.getState().errorId).toBe('gig-1')
  expect(useGigsStore.getState().isLoading).toBe(false)
})

test('a new load clears a previous failure', async () => {
  useGigsStore.setState({ error: 'boom', errorId: 'gig-1' })
  mockGet.mockResolvedValue(gigDetail({ escrow_id: 'gig-2' }))

  await useGigsStore.getState().fetchGigDetail('gig-2')

  expect(useGigsStore.getState().error).toBeNull()
  expect(useGigsStore.getState().errorId).toBeNull()
})

test('reviewEscrow rethrows so the sheet can keep the input', async () => {
  mockReview.mockRejectedValue(new Error('already reviewed'))
  await expect(
    useGigsStore.getState().reviewEscrow('gig-1', { score: 5 }),
  ).rejects.toThrow('already reviewed')
  expect(useGigsStore.getState().isLoading).toBe(false)
})
