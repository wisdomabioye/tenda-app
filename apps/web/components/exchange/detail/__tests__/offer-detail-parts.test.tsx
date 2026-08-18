/**
 * The offer page's three read blocks — headline, trader, terms — and its
 * aside.
 *
 * The recurring assertion is what is NOT claimed: no invented reputation, no
 * minimum, no partial fill, and no party-scoped field on a page an outsider
 * can open.
 */
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OFFER_ASIDE_COPY,
  OFFER_DETAIL_COPY,
  OFFER_TERMS_COPY,
  OfferActionAside,
  OfferHeadline,
  OfferTerms,
  TRADER_CARD_COPY,
  TraderCard,
} from '@/components/exchange/detail'
import { makeExchangeDetail, makeUserRef } from '../../../../test/factories/exchange'

const LOADED_FEE = {
  feeBps: 250,
  feePct: '2.50',
  feeRaw: BigInt(1_250_000),
  netRaw: BigInt(48_750_000),
}
/** Platform config is a fetch; before it lands every figure is null. */
const PENDING_FEE = { feeBps: null, feePct: null, feeRaw: null, netRaw: null }
const fee = vi.hoisted(() => ({
  current: {
    feeBps: 250 as number | null,
    feePct: '2.50' as string | null,
    feeRaw: BigInt(1_250_000) as bigint | null,
    netRaw: BigInt(48_750_000) as bigint | null,
  },
}))
vi.mock('@/hooks/escrow/useEscrowFee', () => ({ useEscrowFee: () => fee.current }))

beforeEach(() => {
  fee.current = LOADED_FEE
})
// Standing is its own fetch and renders nothing until it lands; the card's
// contract here is what IT draws.
vi.mock('@/hooks/profile/useStanding', () => ({ useUserStanding: () => null }))

describe('OfferHeadline', () => {
  it('leads with the rate and names its unit from the offer', () => {
    render(<OfferHeadline offer={makeExchangeDetail()} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(within(heading).getByText('₦1,500')).toBeInTheDocument()
    expect(within(heading).getByText('NGN per USDC')).toBeInTheDocument()
  })

  it('says which side the offer is, and carries the escrow reference', () => {
    render(<OfferHeadline offer={makeExchangeDetail()} />)
    expect(screen.getByText(OFFER_DETAIL_COPY.sideLabel('USDC_SOL'))).toBeInTheDocument()
    expect(screen.getByText('exch-1')).toBeInTheDocument()
  })

  it('does not promise a re-quote the escrow never performs', () => {
    render(<OfferHeadline offer={makeExchangeDetail()} />)
    // The comp says the rate is fixed "the moment you confirm". It was fixed
    // when the seller posted, and saying otherwise invites an expectation.
    expect(screen.getByText(OFFER_DETAIL_COPY.rateNote)).toBeInTheDocument()
    expect(screen.queryByText(/the moment you confirm/i)).toBeNull()
  })
})

describe('TraderCard', () => {
  const offer = makeExchangeDetail()

  it('shows the rating it has, as stars AND as the number', () => {
    render(
      <TraderCard
        trader={makeUserRef({ id: 'seller-1', review_score: '4.70' })}
        offer={offer}
        currentUserId="me"
      />,
    )
    expect(screen.getByRole('img', { name: '4.7 out of 5' })).toBeInTheDocument()
    expect(screen.getByText('4.70')).toBeInTheDocument()
  })

  it('says a trader is UNRATED rather than scoring them zero', () => {
    render(
      <TraderCard
        trader={makeUserRef({ id: 'seller-1', review_score: null })}
        offer={offer}
        currentUserId="me"
      />,
    )
    expect(screen.getByText(TRADER_CARD_COPY.unrated)).toBeInTheDocument()
    expect(screen.getByText(TRADER_CARD_COPY.unratedNote)).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('invents no reputation statistic', () => {
    const { container } = render(
      <TraderCard trader={makeUserRef({ id: 'seller-1' })} offer={offer} currentUserId="me" />,
    )
    const text = container.textContent ?? ''
    for (const invented of ['trades settled', 'completion rate', 'replies within', 'trading since']) {
      expect(text).not.toContain(invented)
    }
  })

  it('offers the profile and a message in THIS escrow’s context', () => {
    render(
      <TraderCard trader={makeUserRef({ id: 'seller-1' })} offer={offer} currentUserId="me" />,
    )
    expect(screen.getByRole('link', { name: /View .* profile/ })).toHaveAttribute(
      'href',
      '/profile/seller-1',
    )
    const message = screen.getByRole('link', { name: /^Message / })
    expect(message.getAttribute('href')).toContain('/chat/seller-1?escrowId=exch-1')
    expect(message.getAttribute('href')).toContain('kind=exchange')
  })

  it('counts the reviews left on THIS trade, worded for one and for many', () => {
    const { rerender } = render(
      <TraderCard trader={makeUserRef({ id: 'seller-1' })} offer={offer} currentUserId="me" />,
    )
    expect(screen.getByText('reviews on this trade')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()

    rerender(
      <TraderCard
        trader={makeUserRef({ id: 'seller-1' })}
        offer={makeExchangeDetail({
          reviews: [
            {
              id: 'rev-1',
              escrow_id: 'exch-1',
              reviewer_id: 'buyer-1',
              reviewee_id: 'seller-1',
              score: 5,
              comment: null,
              created_at: '2026-08-15T10:00:00.000Z',
            },
          ],
        })}
        currentUserId="me"
      />,
    )
    expect(screen.getByText('review on this trade')).toBeInTheDocument()
  })

  it('marks a Seeker trader, and nobody else', () => {
    const { rerender } = render(
      <TraderCard
        trader={makeUserRef({ id: 'seller-1', is_seeker: true })}
        offer={offer}
        currentUserId="me"
      />,
    )
    expect(screen.getByText(TRADER_CARD_COPY.seeker)).toBeInTheDocument()

    rerender(
      <TraderCard
        trader={makeUserRef({ id: 'seller-1', is_seeker: false })}
        offer={offer}
        currentUserId="me"
      />,
    )
    expect(screen.queryByText(TRADER_CARD_COPY.seeker)).toBeNull()
  })

  it('offers no way to message YOURSELF', () => {
    render(
      <TraderCard trader={makeUserRef({ id: 'me' })} offer={offer} currentUserId="me" />,
    )
    expect(screen.queryByRole('link', { name: /^Message / })).toBeNull()
    expect(screen.getByText(TRADER_CARD_COPY.you)).toBeInTheDocument()
  })
})

describe('OfferTerms', () => {
  it('lists the escrow’s own figures, fee included', () => {
    render(<OfferTerms offer={makeExchangeDetail()} />)
    expect(screen.getByText(OFFER_TERMS_COPY.locked)).toBeInTheDocument()
    expect(screen.getByText('50 USDC')).toBeInTheDocument()
    expect(screen.getByText('₦75,000')).toBeInTheDocument()
    expect(screen.getByText(OFFER_TERMS_COPY.fee('2.50'))).toBeInTheDocument()
    expect(screen.getByText('− 1.25 USDC')).toBeInTheDocument()
  })

  it('states no minimum and no "available", because the offer cannot be split', () => {
    const { container } = render(<OfferTerms offer={makeExchangeDetail()} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('Minimum')
    expect(text).not.toContain('available')
  })

  it('shows a placeholder — never a zero fee — before the platform config lands', () => {
    // `useEscrowFee` answers nulls until the config fetch resolves. "− 0 USDC"
    // there would be a claim about the fee, and the wrong one.
    fee.current = PENDING_FEE
    render(<OfferTerms offer={makeExchangeDetail()} />)
    expect(screen.getByText(OFFER_TERMS_COPY.fee(null))).toBeInTheDocument()
    expect(screen.getByText(OFFER_TERMS_COPY.unknown)).toBeInTheDocument()
  })

  it('omits a closing date the offer does not have', () => {
    const { rerender } = render(<OfferTerms offer={makeExchangeDetail({ accept_deadline: null })} />)
    expect(screen.queryByText(OFFER_TERMS_COPY.closes)).toBeNull()

    rerender(
      <OfferTerms offer={makeExchangeDetail({ accept_deadline: '2026-08-20T10:00:00.000Z' })} />,
    )
    expect(screen.getByText(OFFER_TERMS_COPY.closes)).toBeInTheDocument()
  })
})

describe('OfferActionAside', () => {
  it('tells a BUYER what they pay and what actually reaches them', () => {
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="buyer">
        <button type="button">Accept offer</button>
      </OfferActionAside>,
    )
    expect(screen.getByText(OFFER_DETAIL_COPY.youPay)).toBeInTheDocument()
    expect(screen.getByText('₦75,000')).toBeInTheDocument()
    // NET, not the 50 gross: the fee comes out of what the buyer receives.
    expect(screen.getByText('48.75 USDC')).toBeInTheDocument()
    expect(screen.queryByText('50 USDC')).toBeNull()
    expect(screen.getByText(OFFER_DETAIL_COPY.receiveNote)).toBeInTheDocument()
  })

  it('does not tell a SELLER they are paying fiat for their own crypto', () => {
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="seller">
        <button type="button">Cancel offer</button>
      </OfferActionAside>,
    )
    expect(screen.getByText(OFFER_ASIDE_COPY.sellerPay)).toBeInTheDocument()
    expect(screen.getByText('50 USDC')).toBeInTheDocument()
    expect(screen.getByText(OFFER_ASIDE_COPY.sellerReceive)).toBeInTheDocument()
    expect(screen.getByText('₦75,000')).toBeInTheDocument()
    expect(screen.queryByText(OFFER_DETAIL_COPY.youPay)).toBeNull()
  })

  it('has NO amount field — the escrow cannot be partially taken', () => {
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="buyer">
        <button type="button">Accept offer</button>
      </OfferActionAside>,
    )
    // The comp's input would let a reader type 20 and then lock 50.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('falls back to the GROSS rather than a blank while the fee is unknown', () => {
    fee.current = PENDING_FEE
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="buyer">
        <span />
      </OfferActionAside>,
    )
    expect(screen.getByText('50 USDC')).toBeInTheDocument()
    // And no note claiming a fee has been taken off it.
    expect(screen.queryByText(OFFER_DETAIL_COPY.receiveNote)).toBeNull()
  })

  it('hosts the real transition set rather than a CTA of its own', () => {
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="buyer">
        <button type="button">Accept offer</button>
      </OfferActionAside>,
    )
    expect(screen.getByRole('button', { name: 'Accept offer' })).toBeInTheDocument()
    expect(screen.getByText(OFFER_DETAIL_COPY.ctaNote)).toBeInTheDocument()
  })

  it('walks through what happens next, in order', () => {
    render(
      <OfferActionAside offer={makeExchangeDetail()} perspective="buyer">
        <span />
      </OfferActionAside>,
    )
    const steps = screen.getByRole('list')
    expect(within(steps).getAllByRole('listitem')).toHaveLength(
      OFFER_DETAIL_COPY.steps.length,
    )
    expect(steps.tagName).toBe('OL')
  })
})
