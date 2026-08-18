/**
 * The offer page's strings, and the one derivation that decides which clock
 * the countdown block is showing.
 */
import type { EscrowStatus, ExchangeDetail } from '@tenda/shared'
import { ASSET_META, computeRelevantDeadline, formatDurationShort } from '@tenda/shared'

export const OFFER_DETAIL_COPY = {
  back: 'All offers',
  sideLabel: (asset: string) => `Selling ${ASSET_META[asset]?.symbol ?? asset}`,
  rateUnit: (currency: string, asset: string) =>
    `${currency} per ${ASSET_META[asset]?.symbol ?? asset}`,
  /**
   * The comp says the rate is "fixed the moment you confirm". It is fixed
   * EARLIER than that — the seller set it when they posted, and the escrow
   * carries `fiat_amount` for the whole offer — so confirming does not quote
   * you, it accepts a quote already on the table. Saying otherwise would
   * invite a reader to expect a re-quote that never happens.
   */
  rateNote:
    'The seller fixed this rate when they posted. It does not move while the payment window runs, and it is never re-quoted.',
  trader: 'The person on the other side',
  terms: 'Terms',
  events: 'Order of events',
  /** Every step is a real transition of this escrow, in the order it happens. */
  steps: [
    'You accept, and the crypto stays locked in escrow — the seller cannot move it.',
    'The payment window opens and you pay the seller in fiat, off-platform.',
    'You mark the payment sent, attaching your receipt as proof.',
    'The seller confirms the money arrived, and escrow releases the crypto to you.',
  ],
  ctaNote: 'You will see exactly what you are signing, including the fee, before anything is committed.',
  youPay: 'You pay',
  youReceive: 'You receive',
  /** Net of the platform fee — the gross alone misstates what lands. */
  receiveNote: 'After the platform fee. This is what reaches your wallet.',
  proofs: 'Payment proof',
  unavailableTitle: 'Offer not available',
  unavailableBody:
    'It may have been taken by someone else, cancelled, or withdrawn. Nothing of yours was affected.',
  loadFailedTitle: 'This offer could not be loaded',
  loadFailedBody: 'Nothing has changed on-chain. This is a read failure, and retrying is safe.',
  retry: 'Try again',
} as const

export type OfferClockKind = 'accept' | 'pay' | 'confirm' | 'window'

/**
 * What the countdown block is counting, or null when there is nothing to count.
 *
 * The comp draws one clock — the payment window — because it draws one state.
 * A real offer moves through three, and each has its OWN deadline, so a single
 * hardcoded window would be showing the wrong number on two of them. When an
 * open offer has no closing deadline at all there is no clock to run, but the
 * window is still the fact the reader is deciding on, so it is stated
 * statically rather than dropped.
 */
export interface OfferClock {
  kind: OfferClockKind
  label: string
  note: string
  /** Live when present; `null` means `staticValue` is the whole answer. */
  deadline: Date | null
  staticValue: string | null
}

const CLOCK_COPY: Record<OfferClockKind, { label: string; note: string }> = {
  accept: {
    label: 'Offer closes in',
    note: 'After this the offer expires and the crypto returns to the seller.',
  },
  pay: {
    label: 'Pay within',
    note: 'Miss this and the trade cancels itself. Nothing is charged.',
  },
  confirm: {
    label: 'Seller confirms within',
    note: 'If they do not, you can claim the crypto out of escrow yourself.',
  },
  window: {
    label: 'Payment window',
    note: 'How long you get to pay, once you accept. The clock starts then, not now.',
  },
}

/** Statuses that still have a clock worth showing. */
const LIVE_STATUSES: readonly EscrowStatus[] = ['open', 'accepted', 'submitted']

export function offerClockFor(
  offer: Pick<
    ExchangeDetail,
    'status' | 'accept_deadline' | 'completion_deadline' | 'approval_deadline' | 'payment_window_seconds'
  >,
): OfferClock | null {
  if (!LIVE_STATUSES.includes(offer.status)) return null

  const deadline = computeRelevantDeadline(offer)
  if (deadline === null) {
    // Only reachable while open: an accepted or submitted escrow always
    // carries the deadline its transition stamped.
    if (offer.status !== 'open') return null
    return {
      kind: 'window',
      ...CLOCK_COPY.window,
      deadline: null,
      staticValue: formatDurationShort(offer.payment_window_seconds),
    }
  }

  const kind: OfferClockKind =
    offer.status === 'open' ? 'accept' : offer.status === 'accepted' ? 'pay' : 'confirm'
  return { kind, ...CLOCK_COPY[kind], deadline, staticValue: null }
}
