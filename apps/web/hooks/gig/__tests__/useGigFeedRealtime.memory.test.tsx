/**
 * The hook's revision memory is bounded (#73) at BOTH places it grows: the
 * per-render seed and the reconcile branch. The reducer bounds its own path;
 * these are the two the hook owns. Observed through behaviour, not the ref:
 * a stale frame for a departed row is refused while remembered and accepted
 * once forgotten — the stated trade, pinned here so a future "remember
 * everything" cannot creep back.
 */
import { render, screen } from '@testing-library/react'
import { useLayoutEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GIG_FEED_REVISION_MEMORY, type GigFeedServerFrame, type GigSummary } from '@tenda/shared'
import { deliveryGig } from '@/e2e/fixtures/gigs'

const seams = vi.hoisted(() => ({
  listener: null as ((event: GigFeedServerFrame) => void) | null,
}))
vi.mock('@/stores/realtime.store', () => ({
  useRealtimeStore: (select: (state: { connected: boolean }) => boolean) => select({ connected: true }),
  subscribeGigFeedChannel: (listener: (event: GigFeedServerFrame) => void) => {
    seams.listener = listener
    return () => {
      seams.listener = null
    }
  },
}))

import { useGigFeedRealtime } from '@/hooks/gig/useGigFeedRealtime'

function gig(id: string, revision: string, title: string): GigSummary {
  return { ...deliveryGig, escrow_id: id, public_feed_revision: revision, title }
}

function frameFor(item: GigSummary, revision: string): GigFeedServerFrame {
  return {
    type: 'gig_available',
    channel: 'feed:gigs',
    event_id: `event-${item.escrow_id}-${revision}`,
    escrow_id: item.escrow_id,
    gig_revision: revision,
    occurred_at: '2026-08-25T00:00:00.000Z',
    gig: { ...item, public_feed_revision: revision },
  }
}

function Harness({ items, frame }: { items: readonly GigSummary[]; frame?: GigFeedServerFrame }) {
  const [applied, setApplied] = useState<readonly GigSummary[] | null>(null)
  const rows = applied ?? items
  useGigFeedRealtime<GigSummary>({
    items: rows,
    query: {},
    project: (g) => g,
    applyItems: (next) => setApplied(next),
    onReconcile: () => {},
  })
  useLayoutEffect(() => {
    if (frame !== undefined) seams.listener?.(frame)
  }, [frame])
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.escrow_id}>{row.title}</li>
      ))}
    </ul>
  )
}

const FIRST = gig('first', '7', 'First, current at revision 7')
const page = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => gig(`${prefix}-${i}`, '1', `${prefix} ${i}`))

describe('useGigFeedRealtime revision memory (#73)', () => {
  it('a departed row is still guarded while it is among the remembered departures', () => {
    const { rerender } = render(<Harness items={[FIRST]} />)
    // FIRST departs; fewer than the memory follow it out.
    rerender(<Harness items={page(10, 'a')} />)
    rerender(<Harness items={page(10, 'b')} />)
    rerender(<Harness items={page(10, 'b')} frame={frameFor(gig('first', '6', 'First, stale at 6'), '6')} />)
    expect(screen.queryByText('First, stale at 6')).not.toBeInTheDocument()
  })

  it('once more than the memory have departed after it, the same stale frame reads as new — the stated trade', () => {
    const { rerender } = render(<Harness items={[FIRST]} />)
    // Enough churn to push FIRST out of memory: each page departs entirely.
    const pages = Math.ceil((GIG_FEED_REVISION_MEMORY + 1) / 50) + 1
    for (let p = 0; p < pages; p += 1) rerender(<Harness items={page(50, `p${p}`)} />)
    rerender(<Harness items={page(50, 'last')} frame={frameFor(gig('first', '6', 'First, stale at 6'), '6')} />)
    expect(screen.getByText('First, stale at 6')).toBeInTheDocument()
  })
})
