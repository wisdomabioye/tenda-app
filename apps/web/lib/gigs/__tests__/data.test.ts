import { vi } from 'vitest'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ApiClientError: actual.ApiClientError,
    api: { gigs: { list: vi.fn(), get: vi.fn() }, platform: { chains: vi.fn() } },
  }
})

import { api, ApiClientError } from '@/api/client'
import { getGig, listEnabledChains, listGigs } from '@/lib/gigs/data'

const gigsApi = vi.mocked(api.gigs)
const platformApi = vi.mocked(api.platform)

describe('listGigs', () => {
  it('passes the query through to the anonymous client', async () => {
    gigsApi.list.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 })
    await listGigs({ category: 'delivery', limit: 20 })
    expect(gigsApi.list).toHaveBeenCalledWith({ category: 'delivery', limit: 20 })
  })
})

describe('getGig', () => {
  it('returns the detail on success', async () => {
    const detail = { escrow_id: 'gig-1', title: 'Deliver a parcel' }
    gigsApi.get.mockResolvedValue(detail as never)
    expect(await getGig('gig-1')).toBe(detail)
    expect(gigsApi.get).toHaveBeenCalledWith({ id: 'gig-1' })
  })

  it('maps a 404 (unknown OR hidden gig) to null for notFound()', async () => {
    gigsApi.get.mockRejectedValue(new ApiClientError(404, 'Not Found', 'no such gig'))
    expect(await getGig('hidden-gig')).toBeNull()
  })

  it('rethrows non-404 failures — an API outage is not a 404 page', async () => {
    gigsApi.get.mockRejectedValue(new ApiClientError(500, 'Internal', 'boom'))
    await expect(getGig('gig-err')).rejects.toMatchObject({ statusCode: 500 })
  })
})

describe('listEnabledChains', () => {
  it('maps the running registry to filter options', async () => {
    platformApi.chains.mockResolvedValue({
      data: [
        {
          id: 'solana:devnet',
          namespace: 'solana',
          display_name: 'Solana Devnet',
          escrow_address: 'Escrw1',
          assets: [],
        },
      ],
    })
    expect(await listEnabledChains()).toEqual([{ id: 'solana:devnet', label: 'Solana Devnet' }])
  })

  it('degrades to no options when the registry read fails — never a 400-able filter', async () => {
    platformApi.chains.mockRejectedValue(new ApiClientError(500, 'Internal', 'down'))
    expect(await listEnabledChains()).toEqual([])
  })
})
