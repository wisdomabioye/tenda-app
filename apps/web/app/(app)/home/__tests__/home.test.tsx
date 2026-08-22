import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { deliveryGig } from '@/e2e/fixtures/gigs'

const listGigs = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({ api: { gigs: { list: listGigs } } }))

import HomePage from '@/app/(app)/home/page'

beforeEach(() => {
  listGigs.mockReset()
})

it('shows a compact loading state until open gigs arrive', () => {
  listGigs.mockReturnValue(new Promise(() => {}))
  render(<HomePage />)
  expect(screen.getByLabelText('Loading open gigs')).toHaveAttribute('aria-busy', 'true')
})

it('renders open gigs and their public detail links', async () => {
  listGigs.mockResolvedValue({ data: [deliveryGig], total: 1 })
  render(<HomePage />)
  expect(await screen.findByRole('link', { name: /Deliver a parcel across Yaba/ })).toHaveAttribute(
    'href',
    '/gig/gig-delivery-1',
  )
  expect(listGigs).toHaveBeenCalledWith({ limit: 6 })
})

it('renders the honest empty state after a successful empty response', async () => {
  listGigs.mockResolvedValue({ data: [], total: 0 })
  render(<HomePage />)
  expect(await screen.findByText('No open gigs right now')).toBeInTheDocument()
})

it('offers a retry after failure and replaces the error with recovered data', async () => {
  listGigs
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: [deliveryGig], total: 1 })
  render(<HomePage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(deliveryGig.title)).toBeInTheDocument()
  expect(listGigs).toHaveBeenCalledTimes(2)
})
