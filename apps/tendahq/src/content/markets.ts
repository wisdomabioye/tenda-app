/**
 * Fiat markets — DERIVED from the shared payout registry, the same specs the
 * server validates against, so the landing can never advertise a corridor the
 * product will refuse.
 *
 * THE DISTINCTION THIS FILE EXISTS TO KEEP:
 *
 *   - `SUPPORTED_CURRENCIES` (8) is a DISPLAY preference — what you can see
 *     your balance quoted in. It is not a trading capability.
 *   - `PAYOUT_CURRENCIES` (3) is what an offer can actually be denominated in.
 *     `routes/v1/exchange` requires a sell offer's `fiat_currency` to equal
 *     `payoutCurrencyForCountry(account.country)`, and the payout-country
 *     picker offers only NG, KE and GH — so those three are the whole set.
 *
 * The landing conflated the two and advertised "8 corridors". Deriving both
 * numbers from their real sources is what stops that recurring the next time
 * a currency is added for display only.
 */

import { PAYOUT_COUNTRY_SPECS, PAYOUT_CURRENCIES } from '@tenda/shared/fiat/payout'
import { SUPPORTED_CURRENCIES } from '@/data/currencies'
import { prose } from '@/lib/prose'

/** Currency codes an exchange offer can be denominated in ('NGN','KES','GHS'). */
export const TRADE_CURRENCIES: readonly string[] = PAYOUT_CURRENCIES

/** Country names we settle fiat in, in registry order ('Nigeria','Kenya','Ghana'). */
export const TRADE_COUNTRY_NAMES: readonly string[] = Object.values(PAYOUT_COUNTRY_SPECS).map(
  (spec) => spec.countryName,
)

/** "Nigeria, Kenya and Ghana". */
export const TRADE_COUNTRIES_PROSE = prose(TRADE_COUNTRY_NAMES)

/** "NGN, KES and GHS". */
export const TRADE_CURRENCIES_PROSE = prose(TRADE_CURRENCIES)

/** How many markets fiat actually settles in today. */
export const TRADE_MARKET_COUNT = TRADE_COUNTRY_NAMES.length

/** How many currencies a balance can be DISPLAYED in — not a trading claim. */
export const DISPLAY_CURRENCY_COUNT = SUPPORTED_CURRENCIES.length
