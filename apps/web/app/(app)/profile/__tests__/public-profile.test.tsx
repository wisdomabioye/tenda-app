/**
 * /profile/[id] — a stranger's page, which is where the rating denominator
 * earns its keep: this is the screen someone reads before deciding to trade.
 *
 * The review TOTAL comes from the server; the list is one page of it. Those
 * two numbers must not be confused, in either direction.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const { getMock, reviewsMock } = vi.hoisted(() => ({ getMock: vi.fn(), reviewsMock: vi.fn() }))

vi.mock('@/api/client', () => ({
  api: {
    users: {
      get: (...a: unknown[]) => getMock(...a),
      reviews: (...a: unknown[]) => reviewsMock(...a),
    },
  },
}))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'u2' }) }))
vi.mock('@/components/profile/StandingBadge', () => ({ StandingBadge: () => null }))

import UserProfilePage from '@/app/(app)/profile/[id]/page'
import type { User } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'

const USER = {
  id: 'u2',
  first_name: 'Grace',
  last_name: 'Hopper',
  avatar_url: null,
  review_score: '4.80',
  is_seeker: false,
  country: 'NG',
  city: 'Lagos',
  bio: null,
}

const review = (id: string) => ({
  id,
  rating: 5,
  comment: 'Great work',
  created_at: '2026-01-01T00:00:00Z',
  reviewer: { id: 'u3', first_name: 'A', last_name: 'B', avatar_url: null },
})

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(USER)
  reviewsMock.mockReset()
  useAuthStore.setState({ user: { id: 'u1' } as User })
})

test('states the rating with the number of reviews behind it', async () => {
  reviewsMock.mockResolvedValue({ data: [review('r1'), review('r2')], total: 2 })
  render(<UserProfilePage />)
  await waitFor(() => expect(screen.getByText('4.8')).toBeInTheDocument())
  expect(screen.getByText('from 2 reviews')).toBeInTheDocument()
})

test('says how many reviews exist, not how many fitted on the page', async () => {
  // 20 shown of 41 — without this the reader would take 20 for the total.
  reviewsMock.mockResolvedValue({
    data: Array.from({ length: 20 }, (_, i) => review(`r${i}`)),
    total: 41,
  })
  render(<UserProfilePage />)
  await waitFor(() => expect(screen.getByText('showing 20 of 41')).toBeInTheDocument())
  expect(screen.getByText('from 41 reviews')).toBeInTheDocument()
})

test('does not caption a page that already holds every review', async () => {
  reviewsMock.mockResolvedValue({ data: [review('r1')], total: 1 })
  render(<UserProfilePage />)
  await waitFor(() => expect(screen.getByText('from 1 review')).toBeInTheDocument())
  expect(screen.queryByText(/showing/)).not.toBeInTheDocument()
})

test('an unrated stranger is said to be unrated, never scored', async () => {
  getMock.mockResolvedValue({ ...USER, review_score: null })
  reviewsMock.mockResolvedValue({ data: [], total: 0 })
  render(<UserProfilePage />)
  await waitFor(() => expect(screen.getByText('No reviews yet')).toBeInTheDocument())
  expect(screen.queryByRole('img', { name: /out of 5/ })).not.toBeInTheDocument()
})

test('offers a way to reach the reviews it says exist', async () => {
  // Naming a total the page cannot show is a taunt: every other list surface
  // on web pages with Load more, and the endpoint takes an offset.
  reviewsMock.mockResolvedValue({
    data: Array.from({ length: 20 }, (_, i) => review(`r${i}`)),
    total: 41,
  })
  render(<UserProfilePage />)
  const more = await screen.findByRole('button', { name: /Load more/ })

  reviewsMock.mockResolvedValue({ data: [review('r20')], total: 41 })
  await userEvent.click(more)

  // Asks for the NEXT page, by offset — never re-fetches page one.
  await waitFor(() =>
    expect(reviewsMock).toHaveBeenLastCalledWith({ id: 'u2' }, { limit: 20, offset: 20 }),
  )
  await waitFor(() => expect(screen.getByText('showing 21 of 41')).toBeInTheDocument())
})

test('offers no Load more once every review is on the page', async () => {
  reviewsMock.mockResolvedValue({ data: [review('r1')], total: 1 })
  render(<UserProfilePage />)
  await waitFor(() => expect(screen.getByText('from 1 review')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument()
})
