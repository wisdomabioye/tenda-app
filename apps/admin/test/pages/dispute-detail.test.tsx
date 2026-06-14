import { test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import type { DisputeSummary, DisputeThreadResponse } from '@tenda/shared'
import { renderPage } from '../test-utils'
import DisputeDetailPage from '@/app/(dashboard)/disputes/[id]/page'
import { adminApi } from '@/api/client'
import { ApiError } from '@/lib/api'
import { setSession } from '@/lib/auth'

vi.mock('@/api/client', () => ({
  adminApi: {
    disputes: { get: vi.fn(), claim: vi.fn(), release: vi.fn() },
    disputeThread: { get: vi.fn(), send: vi.fn() },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const get = vi.mocked(adminApi.disputes.get)
const threadGet = vi.mocked(adminApi.disputeThread.get)

function summary(over: Partial<DisputeSummary> = {}): DisputeSummary {
  return {
    dispute_id: 'p1', escrow_id: 'e1', kind: 'gig', subject_title: 'Broken delivery',
    reason: 'item never arrived', raised_by_id: 'r1', raised_by_first_name: 'R', raised_by_last_name: 'X',
    raised_at: '2026-06-10T00:00:00.000Z', assigned_to_id: null, resolved_at: null, winner: null,
    ...over,
  } as DisputeSummary
}
const emptyThread: DisputeThreadResponse = {
  dispute_id: 'p1', escrow_id: 'e1', assigned_to_id: null, read_only: false, messages: [], reads: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setSession('jwt', { id: 'me', role: 'dispute_admin', first_name: 'D', last_name: 'A' })
  threadGet.mockResolvedValue(emptyThread)
})

test('renders the dispute header, unclaimed badge, claim button and thread', async () => {
  get.mockResolvedValue(summary())
  renderPage(<DisputeDetailPage />)
  expect(await screen.findByRole('heading', { name: 'Broken delivery' })).toBeInTheDocument()
  expect(screen.getByText('unclaimed')).toBeInTheDocument()
  expect(screen.getByText('item never arrived')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Claim' })).toBeInTheDocument()
})

test('a 404 renders the not-found state', async () => {
  get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'))
  renderPage(<DisputeDetailPage />)
  expect(await screen.findByText(/Dispute not found/)).toBeInTheDocument()
})
