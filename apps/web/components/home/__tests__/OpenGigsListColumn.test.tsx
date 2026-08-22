import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { deliveryGig } from '@/e2e/fixtures/gigs'

const listGigs = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({ api: { gigs: { list: listGigs } } }))

import { OpenGigsListColumn } from '@/components/home/OpenGigsListColumn'

beforeEach(() => { listGigs.mockReset() })

it('shows the list shell while open gigs load', () => {
  listGigs.mockReturnValue(new Promise(() => {}))
  render(<OpenGigsListColumn />)
  expect(screen.getByRole('heading', { name: 'Open gigs' })).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('opens a gig in the authenticated home detail route', async () => {
  listGigs.mockResolvedValue({ data: [deliveryGig], total: 1 })
  render(<OpenGigsListColumn />)
  expect(await screen.findByRole('link', { name: /Deliver a parcel across Yaba/ })).toHaveAttribute('href', '/home/gigs/gig-delivery-1')
  expect(screen.getByText('1 open')).toBeInTheDocument()
  expect(listGigs).toHaveBeenCalledWith({ limit: 30 })
})

it('renders an honest empty state after a successful empty response', async () => {
  listGigs.mockResolvedValue({ data: [], total: 0 })
  render(<OpenGigsListColumn />)
  expect(await screen.findByText('No open gigs')).toBeInTheDocument()
})

it('retries a failed request and replaces the error with recovered data', async () => {
  listGigs.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [deliveryGig], total: 1 })
  render(<OpenGigsListColumn />)
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(deliveryGig.title)).toBeInTheDocument()
  expect(listGigs).toHaveBeenCalledTimes(2)
})
