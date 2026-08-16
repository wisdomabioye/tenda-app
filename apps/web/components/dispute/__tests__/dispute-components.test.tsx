/**
 * Dispute presentation: the list row's identity/outcome lines, the
 * context header's party chips (self reads "You", raiser flagged,
 * expandable reason), and the bubble's resolved-sender rendering with
 * the mediator's distinct voice.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { DisputeThreadContext, MyDisputeRow as MyDisputeRowData } from '@tenda/shared'
import { MyDisputeRow, DisputeContextHeader, DisputeMessageBubble } from '@/components/dispute'

function rowOf(over: Partial<MyDisputeRowData> = {}): MyDisputeRowData {
  return {
    dispute_id: 'd1',
    escrow_id: 'e1',
    kind: 'gig',
    subject_title: 'Paint my fence',
    status: 'disputed',
    my_role: 'creator',
    counterparty_name: 'Bola Ade',
    reason: 'not done',
    raised_at: '2026-08-15T10:00:00.000Z',
    winner: null,
    resolved_at: null,
    raised_by_me: true,
    ...over,
  }
}

const CONTEXT: DisputeThreadContext = {
  kind: 'gig',
  status: 'disputed',
  chain_id: 'solana:devnet',
  asset: 'USDC_SOL',
  amount_raw: '50000000',
  subject_title: 'Paint my fence',
  parties: [
    { user_id: 'me', role: 'creator', first_name: 'Ada', last_name: 'Okafor', raised_dispute: true },
    { user_id: 'them', role: 'counterparty', first_name: 'Bola', last_name: 'Ade', raised_dispute: false },
  ],
  reason: 'Work was not completed as described in the listing at all.',
  raised_at: null,
  winner: null,
  resolved_at: null,
}

test('the list row links the thread, names the raiser side, shows the outcome once resolved', () => {
  render(<MyDisputeRow row={rowOf()} />)
  const link = screen.getByRole('link', { name: 'Open dispute: Paint my fence' })
  expect(link).toHaveAttribute('href', '/dispute/e1')
  expect(screen.getByText(/You raised this/)).toBeInTheDocument()

  render(<MyDisputeRow row={rowOf({ raised_by_me: false, resolved_at: '2026-08-16T00:00:00Z', winner: 'creator', status: 'resolved' })} />)
  expect(screen.getByText(/Raised against you/)).toBeInTheDocument()
  expect(screen.getByText(/Outcome:/)).toBeInTheDocument()
})

test('context header: self reads You, the raiser carries the flag, the reason expands', async () => {
  render(<DisputeContextHeader context={CONTEXT} currentUserId="me" />)
  expect(screen.getByText('You')).toBeInTheDocument()
  expect(screen.getByText('Bola Ade')).toBeInTheDocument()
  expect(screen.getByLabelText('Raised the dispute')).toBeInTheDocument()

  const toggle = screen.getByRole('button', { name: 'Expand dispute reason' })
  await userEvent.click(toggle)
  expect(screen.getByRole('button', { name: 'Collapse dispute reason' })).toBeInTheDocument()
})

test('bubbles: my voice needs no label; a party shows its label; the mediator reads distinct', () => {
  const message = {
    id: 'm1',
    dispute_id: 'd1',
    sender_id: 'x',
    body: 'hello there',
    attachment_url: null,
    attachment_type: null,
    attachment_size: null,
    created_at: '2026-08-15T10:00:00.000Z',
  }
  const { rerender } = render(
    <DisputeMessageBubble message={message} sender={{ kind: 'me', label: 'You', role: 'creator' }} />,
  )
  expect(screen.queryByText('You')).toBeNull() // own bubbles carry no label

  rerender(
    <DisputeMessageBubble message={message} sender={{ kind: 'party', label: 'Bola (Worker)', role: 'counterparty' }} />,
  )
  expect(screen.getByText('Bola (Worker)')).toBeInTheDocument()

  rerender(
    <DisputeMessageBubble message={message} sender={{ kind: 'mediator', label: 'Mediator', role: null }} onAttachmentPress={vi.fn()} />,
  )
  expect(screen.getByText('Mediator')).toBeInTheDocument()
})
