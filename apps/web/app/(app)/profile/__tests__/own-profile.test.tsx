/**
 * /profile — your own page. What is asserted here is the wiring the comp's
 * "Work you have done" block needs: it is on this route as well as the public
 * one, it reads the first person, and it is absent rather than zeroed on an
 * account that has not finished anything yet.
 *
 * What is NOT proved here is that the chips agree with the "Completed" figure
 * above them — that is a property of the two SQL predicates, and it is asserted
 * where they live (apps/server test/integration/user-completed-work.test.ts,
 * which sums the chips and compares them to that stat's own endpoint).
 */
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { CompletedWorkResponse, GetUserReviewsQuery, GigListQuery } from '@tenda/shared'

const { gigsListMock, reviewsMock, completedWorkMock, loadMethodsMock, ensureWalletsMock } =
  vi.hoisted(() => ({
    gigsListMock: vi.fn(),
    reviewsMock: vi.fn(),
    completedWorkMock: vi.fn<(p: { id: string }) => Promise<CompletedWorkResponse>>(),
    loadMethodsMock: vi.fn(),
    ensureWalletsMock: vi.fn(),
  }))
vi.mock('@/api/client', () => ({
  api: {
    gigs: { list: (query: GigListQuery) => gigsListMock(query) },
    users: {
      reviews: (params: { id: string }, query?: GetUserReviewsQuery) => reviewsMock(params, query),
      completedWork: (params: { id: string }) => completedWorkMock(params),
    },
  },
}))
vi.mock('@/components/profile/RestrictionBanner', () => ({ RestrictionBanner: () => null }))

import ProfilePage from '@/app/(app)/profile/page'
import { useAuthStore } from '@/stores/auth.store'
import { makeUser } from '../../../../test/factories/user'

beforeEach(() => {
  vi.clearAllMocks()
  gigsListMock.mockResolvedValue({ data: [], total: 0 })
  reviewsMock.mockResolvedValue({ data: [], total: 0 })
  completedWorkMock.mockResolvedValue({ data: [] })
  useAuthStore.setState({
    user: makeUser({ id: 'me' }),
    isAuthenticated: true,
    identities: [],
    wallets: [],
    loadMethods: loadMethodsMock,
    ensureWallets: ensureWalletsMock,
  })
})

test('draws the completed-work chips, in the first person', async () => {
  completedWorkMock.mockResolvedValue({
    data: [
      { category: 'delivery', count: 6 },
      { category: 'digital', count: 1 },
    ],
  })
  render(<ProfilePage />)

  // Awaits a chip's own count, so the assertions cannot race a block that
  // rendered its heading before its data.
  expect(await screen.findByText('6')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Work you have done' })).toBeInTheDocument()
  expect(screen.getByText('Delivery')).toBeInTheDocument()
  expect(completedWorkMock).toHaveBeenCalledWith({ id: 'me' })
})

test('an account with nothing finished shows no block, not five zeros', async () => {
  render(<ProfilePage />)

  await waitFor(() => expect(completedWorkMock).toHaveBeenCalled())
  expect(screen.queryByRole('heading', { name: /^Work/ })).not.toBeInTheDocument()
  // The activity tiles are still there — this is the block being absent, not
  // the page failing to render.
  expect(screen.getByLabelText('Activity')).toBeInTheDocument()
})
