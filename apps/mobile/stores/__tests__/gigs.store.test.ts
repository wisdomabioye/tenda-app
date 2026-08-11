/**
 * The gig-detail store's single `selectedGig` slot.
 *
 * One slot serves every gig, so the interesting behaviour is what happens when
 * the id CHANGES: a gig left over from the previous screen must not stay
 * readable while a different one loads. Since approval mode that is not
 * cosmetic — the leftover carries the previous viewer's `viewer` block, i.e.
 * another user's Apply/Withdraw state.
 *
 * The second axis is WHICH failure. A 404 means the gig is unreadable for good
 * (deleted, or a takedown this viewer may no longer see) and the slot must be
 * emptied, or the screen keeps rendering a listing the server has stopped
 * serving with every action button live. A transient failure must do the
 * opposite and leave it alone.
 */
import { useGigsStore } from '../gigs.store'
import { gigDetail } from '@/components/gig/__fixtures__/gig-detail'
import { ApiClientError } from '@/api/client'

const mockGet = jest.fn()
const mockReview = jest.fn()
jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  api: {
    gigs: { get: (...args: unknown[]) => mockGet(...args) },
    escrows: { review: (...args: unknown[]) => mockReview(...args) },
  },
}))

/** The envelope the real client throws for a route that refuses to serve a row. */
function notFound(message = 'Gig not found'): ApiClientError {
  return new ApiClientError(404, 'Not Found', message, 'NOT_FOUND')
}

beforeEach(() => {
  useGigsStore.setState({ selectedGig: null, isLoading: false, error: null })
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

  expect(useGigsStore.getState().error).toEqual({
    // `error` alone cannot say which gig failed, and one slot serves them all —
    // without the id, opening any other gig would show this failure.
    id: 'gig-1',
    message: 'Network request failed',
    gone: false,
  })
  expect(useGigsStore.getState().isLoading).toBe(false)
})

test('a new load clears a previous failure', async () => {
  useGigsStore.setState({ error: { id: 'gig-1', message: 'boom', gone: false } })
  mockGet.mockResolvedValue(gigDetail({ escrow_id: 'gig-2' }))

  await useGigsStore.getState().fetchGigDetail('gig-2')

  expect(useGigsStore.getState().error).toBeNull()
})

// ── which failures empty the slot ───────────────────────────────────────────

test('a 404 on refetch DROPS the gig it was refreshing', async () => {
  // The takedown case: the screen is open, an admin hides the gig, the focus
  // refetch (or a pull-to-refresh) 404s. Leaving the gig in place is what let
  // the stale screen keep offering Accept.
  const gig = gigDetail({ escrow_id: 'gig-1' })
  useGigsStore.setState({ selectedGig: gig })
  mockGet.mockRejectedValue(notFound())

  await useGigsStore.getState().fetchGigDetail('gig-1')

  expect(useGigsStore.getState().selectedGig).toBeNull()
  expect(useGigsStore.getState().error).toEqual({
    id: 'gig-1',
    message: 'Gig not found',
    gone: true,
  })
})

test('a NETWORK failure keeps the gig on screen', async () => {
  // The opposite mistake, and just as bad: blanking a good screen because one
  // request was lost. Only an authoritative "you cannot read this" empties it.
  const gig = gigDetail({ escrow_id: 'gig-1' })
  useGigsStore.setState({ selectedGig: gig })
  mockGet.mockRejectedValue(new Error('Network request failed'))

  await useGigsStore.getState().fetchGigDetail('gig-1')

  expect(useGigsStore.getState().selectedGig).toEqual(gig)
  expect(useGigsStore.getState().error?.gone).toBe(false)
})

test.each([
  ['403 forbidden', new ApiClientError(403, 'Forbidden', 'Nope', 'FORBIDDEN')],
  ['500 server error', new ApiClientError(500, 'Internal', 'Boom', 'INTERNAL_ERROR')],
  ['429 rate limit', new ApiClientError(429, 'Too Many Requests', 'Slow down')],
])('a %s is transient — the gig stays', async (_label, thrown) => {
  const gig = gigDetail({ escrow_id: 'gig-1' })
  useGigsStore.setState({ selectedGig: gig })
  mockGet.mockRejectedValue(thrown)

  await useGigsStore.getState().fetchGigDetail('gig-1')

  expect(useGigsStore.getState().selectedGig).toEqual(gig)
  expect(useGigsStore.getState().error?.gone).toBe(false)
})

test('a LATE 404 never clears a different gig that has since loaded', async () => {
  // The race the id guard in the catch exists for, and the only way to reach
  // it: the pre-fetch reset cannot help here because the slot is filled AFTER
  // the failing request was already in flight.
  //
  // Screen A opens gig-1; the user navigates before it answers; screen B loads
  // gig-2 successfully; then gig-1's request comes back 404 (it was taken down).
  // Without the guard, that late failure blanks gig-2 — a screen the user is
  // looking at, for a gig that is perfectly fine.
  let rejectFirst: (e: unknown) => void = () => {}
  mockGet.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectFirst = reject
    }),
  )
  const first = useGigsStore.getState().fetchGigDetail('gig-1')

  const second = gigDetail({ escrow_id: 'gig-2' })
  mockGet.mockResolvedValueOnce(second)
  await useGigsStore.getState().fetchGigDetail('gig-2')
  expect(useGigsStore.getState().selectedGig).toEqual(second)

  rejectFirst(notFound())
  await first

  expect(useGigsStore.getState().selectedGig).toEqual(second)
  expect(useGigsStore.getState().error?.id).toBe('gig-1')
})

test('reviewEscrow rethrows so the sheet can keep the input', async () => {
  mockReview.mockRejectedValue(new Error('already reviewed'))
  await expect(
    useGigsStore.getState().reviewEscrow('gig-1', { score: 5 }),
  ).rejects.toThrow('already reviewed')
  expect(useGigsStore.getState().isLoading).toBe(false)
})
