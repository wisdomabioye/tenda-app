/**
 * TxConfirmDialog — the pre-sign gate over the SHARED copy table (never
 * mocked: the dialog's visibility contract IS txConfirmCopy returning null
 * for ungated actions).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WALLET_OPEN_NOTE } from '@tenda/shared'
import { TxConfirmDialog } from '@/components/escrow/TxConfirmDialog'

const CTX = { amount: '50 USDC', kind: 'gig' as const }
const noop = () => {}

describe('visibility', () => {
  it('renders nothing for a null action', () => {
    const { container } = render(
      <TxConfirmDialog action={null} ctx={CTX} onConfirm={noop} onCancel={noop} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an ungated action (submit collects input in its own sheet)', () => {
    const { container } = render(
      <TxConfirmDialog action="submit" ctx={CTX} onConfirm={noop} onCancel={noop} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('gated copy', () => {
  it('create (gig) shows the fund copy, the amount, and the wallet note', () => {
    const { container } = render(
      <TxConfirmDialog action="create" ctx={CTX} onConfirm={noop} onCancel={noop} />,
    )
    expect(screen.getByText('Fund this gig?')).toBeInTheDocument()
    expect(screen.getByText(/locks 50 USDC in escrow/)).toBeInTheDocument()
    // The note is appended to the body inside the same paragraph.
    expect(container.textContent).toContain(WALLET_OPEN_NOTE)
    expect(screen.getByRole('button', { name: 'Fund Gig' })).toBeInTheDocument()
  })

  it('exchange kind swaps the wording', () => {
    render(
      <TxConfirmDialog action="create" ctx={{ ...CTX, kind: 'exchange' }} onConfirm={noop} onCancel={noop} />,
    )
    expect(screen.getByText('Publish this offer?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish Offer' })).toBeInTheDocument()
  })

  it('confirm and cancel wire through', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<TxConfirmDialog action="approve" ctx={CTX} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve & Pay' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('loading locks both buttons (ConfirmDialog busy semantics)', () => {
    const onCancel = vi.fn()
    render(<TxConfirmDialog action="approve" ctx={CTX} loading onConfirm={noop} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('net-of-fee honesty rides through to the rendered body', () => {
    render(
      <TxConfirmDialog
        action="approve"
        ctx={{ ...CTX, netAmount: '49.5 USDC', feePct: '1.00' }}
        onConfirm={noop}
        onCancel={noop}
      />,
    )
    expect(screen.getByText(/receives 49\.5 USDC after the 1\.00% platform fee/)).toBeInTheDocument()
  })
})
