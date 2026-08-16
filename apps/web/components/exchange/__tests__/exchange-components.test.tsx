/**
 * Exchange presentation: the order-book card's trade line + linkage, the
 * terms card's buyer-net honesty (fee subtracted, never the gross alone),
 * the payment-instructions card's status-aware copy, and the countdown's
 * live tick.
 */
import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ExchangeOfferCard } from '@/components/exchange/ExchangeOfferCard'
import { ExchangeTermsCard } from '@/components/exchange/ExchangeTermsCard'
import { PaymentInstructionsCard, SellerPayoutCard } from '@/components/exchange/PayoutCards'
import { DeadlineCountdown } from '@/components/shared/DeadlineCountdown'
import { makeExchangeDetail } from '../../../test/factories/exchange'

vi.mock('@/hooks/escrow/useEscrowFee', () => ({
  useEscrowFee: () => ({ feeRaw: BigInt(1500000), netRaw: BigInt(48500000), feePct: 3 }),
}))

const account = {
  kind: 'bank' as const,
  bank_code: '058',
  account_number: '0123456789',
  account_name: 'Ada Okafor',
  country: 'NG',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-16T10:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

test('offer card: links the detail, shows the trade line, status only when asked', () => {
  const offer = makeExchangeDetail()
  const { rerender } = render(<ExchangeOfferCard offer={offer} />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/exchange/exch-1')
  expect(screen.getByText(/Pay within/)).toBeInTheDocument()
  expect(screen.queryByText('Open')).toBeNull()

  rerender(<ExchangeOfferCard offer={offer} showStatus />)
  expect(screen.getByText('Open')).toBeInTheDocument()
})

test('terms card: buyer receives NET (gross − fee), fee row named with its pct', () => {
  render(<ExchangeTermsCard offer={makeExchangeDetail()} />)
  expect(screen.getByText('Platform fee (3%)')).toBeInTheDocument()
  expect(screen.getByText('Buyer receives')).toBeInTheDocument()
  expect(screen.getByText(/48\.5/)).toBeInTheDocument() // net, not the 50 gross
})

test('terms card: the live deadline row appears with status-aware wording', () => {
  render(
    <ExchangeTermsCard
      offer={makeExchangeDetail({
        status: 'accepted',
        completion_deadline: '2026-08-16T11:00:00.000Z',
      })}
    />,
  )
  expect(screen.getByText('Pay in')).toBeInTheDocument()
})

test('payment instructions flip copy between pay and awaiting-confirmation', () => {
  const { rerender } = render(
    <PaymentInstructionsCard account={account} fiatDisplay="₦75,000" reference="EXCH1" status="accepted" />,
  )
  expect(screen.getByText('Pay the seller')).toBeInTheDocument()
  expect(screen.getByText('₦75,000')).toBeInTheDocument()
  expect(screen.getByText(/Reference: EXCH1/)).toBeInTheDocument()

  rerender(
    <PaymentInstructionsCard account={account} fiatDisplay="₦75,000" reference="EXCH1" status="submitted" />,
  )
  expect(screen.getByText('Payment sent')).toBeInTheDocument()
})

test('seller payout card names the bound account', () => {
  render(<SellerPayoutCard account={account} />)
  expect(screen.getByText('Buyer pays into')).toBeInTheDocument()
  expect(screen.getByText('Ada Okafor')).toBeInTheDocument()
})

test('the countdown ticks live and lands on the expired label', () => {
  render(
    <DeadlineCountdown
      deadline="2026-08-16T10:00:05.000Z"
      label="Pay within"
      expiredLabel="Window closed"
    />,
  )
  expect(screen.getByText('0:00:05')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(2_000)
  })
  expect(screen.getByText('0:00:03')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(10_000)
  })
  expect(screen.getByText('Window closed')).toBeInTheDocument()
})

test('the clock shifts through the SHARED urgency tones as time runs out', () => {
  // > 2h → normal; < 2h → amber; < 30m → red; past → expired tertiary.
  const { rerender } = render(<DeadlineCountdown deadline="2026-08-16T13:00:00.000Z" />)
  expect(screen.getByText('3:00:00')).toHaveClass('text-content-primary')
  rerender(<DeadlineCountdown deadline="2026-08-16T11:00:00.000Z" />)
  expect(screen.getByText('1:00:00')).toHaveClass('text-feedback-warning-base')
  rerender(<DeadlineCountdown deadline="2026-08-16T10:10:00.000Z" />)
  expect(screen.getByText('0:10:00')).toHaveClass('text-feedback-danger-base')
  rerender(<DeadlineCountdown deadline="2026-08-16T09:00:00.000Z" />)
  expect(screen.getByText('Expired')).toHaveClass('text-content-tertiary')
})
