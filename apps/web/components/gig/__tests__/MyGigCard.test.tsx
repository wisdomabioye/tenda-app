/**
 * The poster's own listing card (/my-gigs and its drafts).
 *
 * Written during the #12 review because that commit consolidated the "where is
 * this gig" rule into shared `gigPlaceLabel` and this file — which #12 renamed
 * — kept its own copy of it. Untested code is how the copy survived the
 * consolidation, so the file joins the coverage ratchet here rather than
 * waiting for the Tier-2 port that will replace it.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, PLACE_UNKNOWN, chainLabel, type GigSummary } from '@tenda/shared'
import { MyGigCard } from '@/components/gig/MyGigCard'
import { deliveryGig, photoGig } from '@/e2e/fixtures/gigs'

const withPlace = (place: Partial<GigSummary>): GigSummary => ({ ...deliveryGig, ...place })

describe('MyGigCard', () => {
  it('links to the gig and leads with its title and amount', () => {
    render(<MyGigCard gig={deliveryGig} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', `/gig/${deliveryGig.escrow_id}`)
    expect(screen.getByRole('heading', { name: deliveryGig.title })).toBeInTheDocument()
    expect(screen.getByText('25 USDC')).toBeInTheDocument()
  })

  it('resolves the country CODE to its name, like every other gig surface', () => {
    // It used to print the bare "NG": `city ?? country ?? 'Anywhere'`.
    render(<MyGigCard gig={withPlace({ city: null, country: 'NG', remote: false })} />)
    expect(screen.getByText('Nigeria')).toBeInTheDocument()
    expect(screen.queryByText(/\bNG\b/)).not.toBeInTheDocument()
  })

  it('joins city and country the way the feed card does', () => {
    render(<MyGigCard gig={deliveryGig} />)
    expect(screen.getByText('Lagos, Nigeria')).toBeInTheDocument()
  })

  it('says Remote for a remote gig', () => {
    render(<MyGigCard gig={photoGig} />)
    expect(screen.getByText('Remote')).toBeInTheDocument()
  })

  it('does NOT claim "Anywhere" for a gig with no location', () => {
    // Anywhere is a claim; the truth is that nobody said. The poster is reading
    // their own listing here, so a wrong answer is most obviously wrong.
    render(<MyGigCard gig={withPlace({ city: null, country: null, remote: false })} />)
    expect(screen.getByText(PLACE_UNKNOWN)).toBeInTheDocument()
    expect(screen.queryByText('Anywhere')).not.toBeInTheDocument()
  })

  it('names the category and the chain from the shared vocabularies', () => {
    render(<MyGigCard gig={deliveryGig} />)
    expect(screen.getByText(CATEGORY_LABELS.delivery)).toBeInTheDocument()
    expect(screen.getByText(chainLabel(deliveryGig.chain_id))).toBeInTheDocument()
  })

  it('says Accept on a direct gig and Apply on an approval gig', () => {
    const { unmount } = render(<MyGigCard gig={deliveryGig} />)
    expect(screen.getByText('Accept')).toBeInTheDocument()
    unmount()

    render(<MyGigCard gig={photoGig} />)
    expect(screen.getByText('Apply')).toBeInTheDocument()
  })

  it('omits the description block entirely when there is none', () => {
    const { container } = render(<MyGigCard gig={withPlace({ description: null })} />)
    expect(container.querySelector('.line-clamp-2')).toBeNull()
  })

  it('omits the posted time when the wire carries none', () => {
    render(<MyGigCard gig={withPlace({ created_at: null })} />)
    // Only the two separators between place and chain survive, not a third.
    expect(screen.getAllByText('·')).toHaveLength(1)
  })
})
