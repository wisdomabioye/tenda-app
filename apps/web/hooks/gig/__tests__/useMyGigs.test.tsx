/**
 * DoD assertion (stage 6): drafts appear only under drafts and "Posted"
 * excludes them BY QUERY — the posted list asks the server for
 * POSTED_ESCROW_STATUSES exactly (no 'draft'), the drafts list for
 * ['draft'] exactly, so no client-side arithmetic can ever mix them.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { POSTED_ESCROW_STATUSES, type GigListQuery } from '@tenda/shared'

const gigsApi = vi.hoisted(() => ({
  list: vi.fn<(q?: GigListQuery) => Promise<{ data: never[]; total: number; limit: number; offset: number }>>(),
}))
const applicationsApi = vi.hoisted(() => ({
  mine: vi.fn(() => Promise.resolve({ data: [], total: 0, limit: 20, offset: 0 })),
}))

vi.mock('@/api/client', () => ({ api: { gigs: gigsApi, applications: applicationsApi } }))

import { useMyGigs } from '@/hooks/gig/useMyGigs'
import { useAuthStore } from '@/stores/auth.store'
import { makeUser } from '../../../test/factories/user'

beforeEach(() => {
  vi.clearAllMocks()
  gigsApi.list.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 })
  useAuthStore.setState({ user: makeUser({ id: 'me' }) })
})

test('posted asks for POSTED_ESCROW_STATUSES (never draft); drafts asks for draft only', async () => {
  renderHook(() => useMyGigs())
  await waitFor(() => expect(gigsApi.list.mock.calls.length).toBeGreaterThanOrEqual(3))

  const queries = gigsApi.list.mock.calls.map(([q]) => q)
  const posted = queries.find((q) => Array.isArray(q?.status) && q.status.length > 1)
  const drafts = queries.find((q) => Array.isArray(q?.status) && q.status.length === 1)
  const working = queries.find((q) => q?.mine === 'working')

  expect(posted?.mine).toBe('created')
  expect(posted?.status).toEqual([...POSTED_ESCROW_STATUSES])
  expect(posted?.status).not.toContain('draft')

  expect(drafts?.mine).toBe('created')
  expect(drafts?.status).toEqual(['draft'])

  expect(working?.status).toBeUndefined() // working = every status on that side
})

test('nothing fires before the session user loads', async () => {
  useAuthStore.setState({ user: null })
  renderHook(() => useMyGigs())
  await Promise.resolve()
  expect(gigsApi.list).not.toHaveBeenCalled()
  expect(applicationsApi.mine).not.toHaveBeenCalled()
})
