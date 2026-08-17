/**
 * The sticky money column. `GigDetailApp` is stubbed on purpose: its own
 * suite covers the session swap, and what matters HERE is which fields the
 * aside hands it — client-component props are serialised into the anonymous
 * HTML, so the allowlist is a disclosure boundary, not a convenience.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { chainLabel, splitAssetAmount } from '@tenda/shared'
import { GIG_DETAIL_COPY } from '@/components/gig/detail/copy'
import { LEAKED_COUNTERPARTY_ID, deliveryGigDetail } from '@/e2e/fixtures/gigs'

const { capturedInitial } = vi.hoisted(() => ({
  capturedInitial: { current: null as Record<string, unknown> | null },
}))

vi.mock('@/components/gig/detail/GigDetailApp', () => ({
  GigDetailApp: ({ initial }: { initial: Record<string, unknown> }) => {
    capturedInitial.current = initial
    return <button type="button">Sign in to accept</button>
  },
}))

const { GigEscrowAside } = await import('@/components/gig/detail/GigEscrowAside')

const gig = deliveryGigDetail

describe('GigEscrowAside', () => {
  it('shows the escrowed net as one figure, split from ONE formatter', () => {
    render(<GigEscrowAside gig={gig} />)
    const { amount, symbol } = splitAssetAmount(gig.amount_raw, gig.asset)
    expect(screen.getByText(amount)).toBeInTheDocument()
    expect(screen.getByText(symbol)).toBeInTheDocument()
    // …and read as one amount in plain text (see GigCard).
    expect(document.body.textContent).toContain(`${amount} ${symbol}`)
  })

  it('says the fee is already out — it does NOT project a second number', () => {
    // Re-deriving the fee here would put two disagreeing figures for the same
    // money on one page; amount_raw is already the chain-attested net.
    render(<GigEscrowAside gig={gig} />)
    expect(screen.getByText(GIG_DETAIL_COPY.lockedNote)).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('names the chain through the shared label, never the CAIP-2 id', () => {
    render(<GigEscrowAside gig={gig} />)
    expect(
      screen.getByText(GIG_DETAIL_COPY.lockedOn(chainLabel(gig.chain_id))),
    ).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(gig.chain_id))).not.toBeInTheDocument()
  })

  it('hands the action island the public allowlist and NOTHING else', () => {
    render(<GigEscrowAside gig={gig} />)
    expect(capturedInitial.current).toEqual({
      escrow_id: gig.escrow_id,
      status: gig.status,
      is_assigned: gig.is_assigned,
      requires_approval: gig.requires_approval,
    })
  })

  it('never serialises a party-scoped field into the anonymous HTML', () => {
    // The fixture is a HOSTILE server: it serves the counterparty anyway.
    const { container } = render(<GigEscrowAside gig={gig} />)
    expect(JSON.stringify(capturedInitial.current)).not.toContain(LEAKED_COUNTERPARTY_ID)
    expect(container.innerHTML).not.toContain(LEAKED_COUNTERPARTY_ID)
  })

  it('carries the settlement steps, keyed to the acceptance mode', () => {
    const { unmount } = render(<GigEscrowAside gig={gig} />)
    expect(screen.getByText(GIG_DETAIL_COPY.settleSteps.accept)).toBeInTheDocument()
    unmount()

    render(<GigEscrowAside gig={{ ...gig, requires_approval: true }} />)
    expect(screen.getByText(GIG_DETAIL_COPY.settleSteps.apply)).toBeInTheDocument()
  })
})
