import { describe, expect, it } from 'vitest'
import { PAYOUT_COUNTRY_SPECS, PAYOUT_CURRENCIES } from '@tenda/shared/fiat/payout'
import { SUPPORTED_CURRENCIES } from '@/data/currencies'
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
 * balance in (8) is not what you can TRADE in (3). The landing shipped "8
 * corridors" by counting the wrong list, so these tests pin the two apart and
 * pin each to its real source.
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
   * page can conflate them again without anyone noticing, so the day a payout
   * market is added for all eight currencies, this test should be deleted
   * deliberately rather than silently pass.
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
   * Only Ghana declares a mobile_money rail; Nigeria and Kenya are bank-only.
   * The deck previously showed M-Pesa against KES, which named an integration
   * that does not exist in a country that has no mobile-money spec.
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
