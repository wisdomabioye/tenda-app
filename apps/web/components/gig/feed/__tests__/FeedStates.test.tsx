import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeedEmpty, FeedError, FeedSkeleton } from '@/components/gig/feed/FeedStates'
import { FeedPager } from '@/components/gig/feed/FeedPager'
import { FEED_COPY } from '@/components/gig/feed/copy'
import { GIGS_PAGE_SIZE, parseGigFeedFilters, type RawSearchParams } from '@/lib/gigs/search-params'

const filters = (params: RawSearchParams = {}) => parseGigFeedFilters(params, new Set())

describe('FeedSkeleton', () => {
  it('is hidden from assistive tech — it has nothing to say', () => {
    const { container } = render(<FeedSkeleton count={3} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden')
  })

  it('never draws more placeholders than a page can hold', () => {
    const { container } = render(<FeedSkeleton count={999} />)
    expect(container.firstElementChild?.children).toHaveLength(GIGS_PAGE_SIZE)
  })
})

describe('FeedEmpty', () => {
  it('blames the filters and offers to clear them, when there ARE filters', () => {
    render(<FeedEmpty filtered />)
    expect(screen.getByText(FEED_COPY.empty.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: FEED_COPY.empty.action })).toHaveAttribute(
      'href',
      '/gigs',
    )
  })

  it('says something TRUE when nothing is filtered, and offers no dead button', () => {
    // "Widen your filters" is useless advice to someone who set none, and
    // Clear would link to the page they are already on.
    render(<FeedEmpty filtered={false} />)
    expect(screen.getByText(FEED_COPY.empty.bareTitle)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: FEED_COPY.empty.action })).not.toBeInTheDocument()
  })
})

describe('FeedError', () => {
  it('announces itself and says the money is untouched', () => {
    render(<FeedError retry={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(FEED_COPY.error.body)).toBeInTheDocument()
  })

  it('retries the failed render rather than linking to the same page', () => {
    const retry = vi.fn()
    render(<FeedError retry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: FEED_COPY.error.action }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('FEED_COPY.feed.count', () => {
  it('agrees with itself about one', () => {
    expect(FEED_COPY.feed.count(1)).toBe('1 gig')
    expect(FEED_COPY.feed.count(0)).toBe('0 gigs')
    expect(FEED_COPY.feed.count(42)).toBe('42 gigs')
  })
})

describe('FeedPager — cursor mode (the plain recency feed)', () => {
  it('follows the server-minted cursor', () => {
    render(<FeedPager filters={filters()} nextCursor="abc" total={99} shown={20} />)
    expect(screen.getByRole('link', { name: /More gigs/ })).toHaveAttribute(
      'href',
      '/gigs?cursor=abc',
    )
  })

  it('renders nothing on the last page', () => {
    const { container } = render(
      <FeedPager filters={filters()} nextCursor={null} total={5} shown={5} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the response carried no cursor field at all', () => {
    const { container } = render(<FeedPager filters={filters()} total={5} shown={5} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FeedPager — offset mode (searched or sorted)', () => {
  it('pages a SEARCHED feed, which the server mints no cursor for', () => {
    // Before this, searching capped the feed at its first twenty rows with no
    // way forward and no sign that more existed.
    render(<FeedPager filters={filters({ q: 'tiler' })} total={44} shown={20} />)
    const next = screen.getByRole('link', { name: /More gigs/ })
    expect(next.getAttribute('href')).toContain(`offset=${GIGS_PAGE_SIZE}`)
    expect(next.getAttribute('href')).toContain('q=tiler')
  })

  it('pages a SORTED feed too', () => {
    render(<FeedPager filters={filters({ sort: 'amount_desc' })} total={44} shown={20} />)
    expect(screen.getByRole('link', { name: /More gigs/ }).getAttribute('href')).toContain(
      'sort=amount_desc',
    )
  })

  it('offers a way back, and never to a negative offset', () => {
    render(<FeedPager filters={filters({ q: 'x', offset: '10' })} total={44} shown={20} />)
    expect(screen.getByRole('link', { name: /Previous/ }).getAttribute('href')).toContain(
      'offset=0',
    )
  })

  it('stops at the end even when the last page is exactly full', () => {
    // A full page is not evidence of a next one — `total` is.
    render(<FeedPager filters={filters({ q: 'x', offset: '20' })} total={40} shown={20} />)
    expect(screen.queryByRole('link', { name: /More gigs/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Previous/ })).toBeInTheDocument()
  })

  it('says where the reader is', () => {
    render(<FeedPager filters={filters({ q: 'x', offset: '20' })} total={44} shown={20} />)
    expect(screen.getByText(FEED_COPY.pager.position(2, 3))).toBeInTheDocument()
  })

  it('renders nothing when one page holds everything', () => {
    const { container } = render(<FeedPager filters={filters({ q: 'x' })} total={4} shown={4} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('never sends a cursor into offset mode — that pairing is a 400', () => {
    render(
      <FeedPager filters={filters({ q: 'x', cursor: 'abc' })} nextCursor="abc" total={44} shown={20} />,
    )
    expect(screen.getByRole('link', { name: /More gigs/ }).getAttribute('href')).not.toContain(
      'cursor',
    )
  })
})
