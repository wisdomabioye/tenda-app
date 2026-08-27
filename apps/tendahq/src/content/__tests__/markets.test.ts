import { describe, expect, it } from 'vitest'
import { PAYOUT_COUNTRY_SPECS, PAYOUT_CURRENCIES } from '@tenda/shared/fiat/payout'
import { SUPPORTED_CURRENCIES } from '@/content/currencies'
import { EXAMPLE_TRADES } from '../trades'
import {
  DISPLAY_CURRENCY_COUNT,
  TRADE_COUNTRIES_PROSE,
  TRADE_CURRENCIES,
  TRADE_CURRENCIES_PROSE,
  TRADE_COUNTRY_NAMES,
  TRADE_MARKET_COUNT,
} from '../markets'

/**
 * The distinction this whole module exists to hold: what you can DISPLAY a
 * balance in is not what you can TRADE in. The landing shipped "8 corridors"
 * by counting the wrong list, so these tests pin the two apart and pin each to
 * its real source.
 *
 * Neither count is named here. This docstring said "(8)" and "(3)"; display is
 * now nine and payout six, so a comment introducing a file about stale numbers
 * was itself stating two.
 */
describe('fiat markets', () => {
  it('takes the tradable currencies from the payout registry, not the display list', () => {
    expect(TRADE_CURRENCIES).toEqual(PAYOUT_CURRENCIES)
  })

  it('keeps the display-currency count separate from the market count', () => {
    expect(DISPLAY_CURRENCY_COUNT).toBe(SUPPORTED_CURRENCIES.length)
    expect(TRADE_MARKET_COUNT).toBe(Object.keys(PAYOUT_COUNTRY_SPECS).length)
  })

  /**
   * The regression the copy actually shipped. If these two ever coincide the
   * page can conflate them again without anyone noticing, so the day payout
   * reaches every display currency, this test should be deleted deliberately
   * rather than silently pass.
   *
   * The gap is narrowing and that is the point of keeping it: payout was three
   * markets when this was written and is now six, against nine display
   * currencies. Three more markets and this assertion becomes the alarm.
   */
  it('has strictly fewer tradable markets than display currencies today', () => {
    expect(TRADE_MARKET_COUNT).toBeLessThan(DISPLAY_CURRENCY_COUNT)
  })

  it('names every payout country, in registry order', () => {
    expect(TRADE_COUNTRY_NAMES).toEqual(
      Object.values(PAYOUT_COUNTRY_SPECS).map((s) => s.countryName),
    )
  })

  it('renders both lists as sentence prose', () => {
    expect(TRADE_COUNTRIES_PROSE).toContain(TRADE_COUNTRY_NAMES[0])
    expect(TRADE_COUNTRIES_PROSE).toContain(' and ')
    expect(TRADE_CURRENCIES_PROSE).toContain(TRADE_CURRENCIES[0])
  })

  /**
   * The trade deck reads as a product screenshot, so a row denominated in a
   * currency the Exchange would refuse is a promise the app breaks. The rows
   * are hand-curated; this is what stops the next hand-curated row drifting.
   */
  it('showcases only currencies an offer can actually be denominated in', () => {
    for (const trade of EXAMPLE_TRADES) {
      expect(PAYOUT_CURRENCIES).toContain(trade.fiat.currency)
    }
  })

  /**
   * Not every market declares a mobile_money rail — Ghana and the Philippines
   * do, the rest are bank-only — so the mapping is read from the specs rather
   * than asserted from memory. The deck previously showed M-Pesa against KES,
   * which named an integration that does not exist in a country with no
   * mobile-money spec. An earlier version of this comment said "only Ghana",
   * which stopped being true when the Philippines shipped.
   */
  it('only shows a mobile-money rail for countries whose spec declares one', () => {
    const currencyToRails = new Map(
      Object.values(PAYOUT_COUNTRY_SPECS).map((spec) => [
        spec.currency,
        spec.rails.map((r) => r.kind),
      ]),
    )
    for (const trade of EXAMPLE_TRADES) {
      if (trade.fiat.rail !== 'Mobile money') continue
      expect(currencyToRails.get(trade.fiat.currency)).toContain('mobile_money')
    }
  })
})
