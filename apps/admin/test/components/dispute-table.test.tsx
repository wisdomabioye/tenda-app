import { test, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { DisputeSummary } from '@tenda/shared'
import { DisputeTable } from '@/components/disputes/dispute-table'

vi.mock('@/api/client', () => ({ adminApi: { disputes: { claim: vi.fn(), release: vi.fn() } } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function dispute(over: Partial<DisputeSummary> = {}): DisputeSummary {
  return {
    dispute_id: 'd1', escrow_id: 'e1', kind: 'gig', subject_title: 'Fix my sink',
    reason: 'work not done', raised_by_id: 'r1', raised_by_first_name: 'Ray', raised_by_last_name: 'X',
    raised_at: '2026-06-10T00:00:00.000Z', assigned_to_id: null, resolved_at: null, winner: null,
    ...over,
  } as DisputeSummary
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('empty list renders the empty-state copy', () => {
  render(<DisputeTable disputes={[]} meId="me" onChanged={() => {}} />)
  expect(screen.getByText('No disputes here.')).toBeInTheDocument()
})

test('renders a row with subject, kind, raiser and an unclaimed badge', () => {
  render(<DisputeTable disputes={[dispute()]} meId="me" onChanged={() => {}} />)
  expect(screen.getByRole('link', { name: 'Fix my sink' })).toHaveAttribute('href', '/disputes/d1')
  expect(screen.getByText('work not done')).toBeInTheDocument()
  expect(screen.getByText('Ray X')).toBeInTheDocument()
  expect(screen.getByText('unclaimed')).toBeInTheDocument()
})

test('status badge reflects claim ownership and resolution', () => {
  const { rerender } = render(<DisputeTable disputes={[dispute({ assigned_to_id: 'me' })]} meId="me" onChanged={() => {}} />)
  expect(screen.getByText('mine')).toBeInTheDocument()
  rerender(<DisputeTable disputes={[dispute({ assigned_to_id: 'other' })]} meId="me" onChanged={() => {}} />)
  expect(screen.getByText('claimed')).toBeInTheDocument()
  rerender(<DisputeTable disputes={[dispute({ resolved_at: '2026-06-11T00:00:00.000Z', winner: 'creator' })]} meId="me" onChanged={() => {}} />)
  expect(screen.getByText(/resolved · creator/)).toBeInTheDocument()
})

test('falls back to "Exchange offer" when there is no subject title', () => {
  render(<DisputeTable disputes={[dispute({ kind: 'exchange', subject_title: null })]} meId="me" onChanged={() => {}} />)
  expect(screen.getByRole('link', { name: 'Exchange offer' })).toBeInTheDocument()
})

test('renders an em dash for a null raised_at', () => {
  render(<DisputeTable disputes={[dispute({ raised_at: null })]} meId="me" onChanged={() => {}} />)
  const row = screen.getByRole('row', { name: /Fix my sink/ })
  expect(within(row).getByText('—')).toBeInTheDocument()
})
