/**
 * Which clock the offer page is showing.
 *
 * The comp draws ONE — the payment window — because it draws one state. A real
 * offer moves through three, each with its own deadline, so a single hardcoded
 * window would be counting the wrong thing on two of them.
 */
import { describe, expect, it } from 'vitest'
import { exchangeChatContext, offerClockFor } from '@/components/exchange/detail'
import { makeExchangeDetail } from '../../../../test/factories/exchange'

describe('offerClockFor', () => {
  it('counts to the offer closing while it is open', () => {
    const clock = offerClockFor(
      makeExchangeDetail({ status: 'open', accept_deadline: '2026-08-20T10:00:00.000Z' }),
    )
    expect(clock?.kind).toBe('accept')
    expect(clock?.deadline?.toISOString()).toBe('2026-08-20T10:00:00.000Z')
  })

  it('counts the PAYMENT window once accepted', () => {
    const clock = offerClockFor(
      makeExchangeDetail({ status: 'accepted', completion_deadline: '2026-08-16T11:00:00.000Z' }),
    )
    expect(clock?.kind).toBe('pay')
    expect(clock?.deadline?.toISOString()).toBe('2026-08-16T11:00:00.000Z')
  })

  it('counts the SELLER’s confirmation window once payment is submitted', () => {
    const clock = offerClockFor(
      makeExchangeDetail({ status: 'submitted', approval_deadline: '2026-08-18T11:00:00.000Z' }),
    )
    expect(clock?.kind).toBe('confirm')
    expect(clock?.deadline?.toISOString()).toBe('2026-08-18T11:00:00.000Z')
  })

  it('states the window STATICALLY on an open offer that never closes', () => {
    // `accept_deadline` is nullable, and a live clock counting to nothing is
    // not an option — but the window is still what the reader is deciding on.
    const clock = offerClockFor(
      makeExchangeDetail({ status: 'open', accept_deadline: null, payment_window_seconds: 5_400 }),
    )
    expect(clock?.kind).toBe('window')
    expect(clock?.deadline).toBeNull()
    expect(clock?.staticValue).toBe('1h 30m')
  })

  it('shows no clock at all once the escrow has stopped moving', () => {
    for (const status of ['completed', 'cancelled', 'refunded', 'disputed', 'resolved', 'draft'] as const) {
      expect(offerClockFor(makeExchangeDetail({ status }))).toBeNull()
    }
  })

  it('gives every clock its own label AND its own advice', () => {
    const kinds = (['open', 'accepted', 'submitted'] as const).map((status) =>
      offerClockFor(
        makeExchangeDetail({
          status,
          accept_deadline: '2026-08-20T10:00:00.000Z',
          completion_deadline: '2026-08-16T11:00:00.000Z',
          approval_deadline: '2026-08-18T11:00:00.000Z',
        }),
      ),
    )
    const labels = kinds.map((clock) => clock?.label)
    const notes = kinds.map((clock) => clock?.note)
    expect(new Set(labels).size).toBe(3)
    expect(new Set(notes).size).toBe(3)
  })
})

describe('exchangeChatContext', () => {
  it('names the trade the way the SERVER names it on a message', () => {
    // `'Trade: ' || fiat_amount || ' ' || fiat_currency` in the conversations
    // route. Two spellings would put two different dividers on one thread.
    expect(exchangeChatContext(makeExchangeDetail())).toEqual({
      id: 'exch-1',
      title: 'Trade: 75000.0000 NGN',
      kind: 'exchange',
    })
  })
})
