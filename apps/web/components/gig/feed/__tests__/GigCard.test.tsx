import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, formatAssetAmount, splitAssetAmount } from '@tenda/shared'
import type { GigSummary } from '@tenda/shared'
import { GigCard } from '@/components/gig/feed/GigCard'
import { CATEGORY_TONE } from '@/components/gig/category-icons'
import { GIG_CARD_COPY } from '@/components/gig/feed/card-copy'
import { deliveryGig, photoGig } from '@/e2e/fixtures/gigs'

/** Hours from now as an ISO string, for the accept-window branches. */
const inHours = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString()

describe('GigCard', () => {
  it('links to the gig by its escrow id', () => {
    render(<GigCard gig={deliveryGig} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', `/gig/${deliveryGig.escrow_id}`)
  })

  it('shows the amount and its ticker as separate elements, from ONE formatter', () => {
    render(<GigCard gig={deliveryGig} />)
    const { amount, symbol } = splitAssetAmount(deliveryGig.amount_raw, deliveryGig.asset)
    expect(screen.getByText(amount)).toBeInTheDocument()
    expect(screen.getByText(symbol)).toBeInTheDocument()
    // 25 USDC at 6dp — a card quietly rendering base units is the failure
    // this pins, and it would look plausible.
    expect(amount).toBe('25')
  })

  it('the two halves read as one amount in plain TEXT, not only to a reader', () => {
    // A copy-paste, a text scraper and a simple crawler all see textContent,
    // and adjacent spans with only a flex gap between them yield "25USDC".
    render(<GigCard gig={deliveryGig} />)
    expect(screen.getByRole('link').textContent).toContain(
      formatAssetAmount(deliveryGig.amount_raw, deliveryGig.asset),
    )
  })

  it('names the category from the shared vocabulary and tints it with its tone', () => {
    render(<GigCard gig={deliveryGig} />)
    const label = screen.getByText(CATEGORY_LABELS.delivery)
    expect(label.className).toContain(CATEGORY_TONE.delivery.text)
  })

  it('says Accept on a direct gig and Apply on an approval gig — before you take it', () => {
    const { unmount } = render(<GigCard gig={deliveryGig} />)
    expect(screen.getByText(GIG_CARD_COPY.accept)).toBeInTheDocument()
    expect(screen.queryByText(GIG_CARD_COPY.apply)).not.toBeInTheDocument()
    unmount()

    render(<GigCard gig={photoGig} />)
    expect(screen.getByText(GIG_CARD_COPY.apply)).toBeInTheDocument()
  })

  it('resolves the country CODE to a name, and answers Remote for a remote gig', () => {
    const { unmount } = render(<GigCard gig={deliveryGig} />)
    expect(screen.getByText('Lagos, Nigeria')).toBeInTheDocument()
    expect(screen.queryByText(/\bNG\b/)).not.toBeInTheDocument()
    unmount()

    render(<GigCard gig={photoGig} />)
    expect(screen.getByText('Remote')).toBeInTheDocument()
  })

  it('warns when the accept window is nearly gone, instead of a constant "Open"', () => {
    const closing: GigSummary = { ...deliveryGig, accept_deadline: inHours(1) }
    render(<GigCard gig={closing} />)
    expect(screen.getByText(GIG_CARD_COPY.closingSoon)).toBeInTheDocument()
    expect(screen.queryByText(GIG_CARD_COPY.open)).not.toBeInTheDocument()
  })

  it('reads Open while there is room, including a gig with no deadline at all', () => {
    const { unmount } = render(<GigCard gig={{ ...deliveryGig, accept_deadline: inHours(72) }} />)
    expect(screen.getByText(GIG_CARD_COPY.open)).toBeInTheDocument()
    unmount()

    render(<GigCard gig={{ ...deliveryGig, accept_deadline: null }} />)
    expect(screen.getByText(GIG_CARD_COPY.open)).toBeInTheDocument()
  })

  it('renders the poster rating with a sayable label, not a bare glyph', () => {
    render(<GigCard gig={deliveryGig} />)
    // The fixture stores '4.80'; the card must not print the second decimal.
    expect(screen.getByLabelText(GIG_CARD_COPY.ratingLabel('4.8'))).toHaveTextContent('★ 4.8')
  })

  it('omits the rating entirely for a poster nobody has reviewed', () => {
    const unrated: GigSummary = {
      ...deliveryGig,
      creator: { ...deliveryGig.creator, review_score: null },
    }
    render(<GigCard gig={unrated} />)
    expect(screen.queryByText(/★/)).not.toBeInTheDocument()
  })

  it('omits the posted time when the wire carries none, rather than an empty slot', () => {
    render(<GigCard gig={{ ...deliveryGig, created_at: null }} />)
    expect(screen.getByRole('link').textContent).not.toContain('·')
  })

  it('marks itself walkable so the keyboard layer can find it', () => {
    render(<GigCard gig={deliveryGig} index={2} />)
    expect(screen.getByRole('link')).toHaveAttribute('data-gig-card', '2')
  })
})
