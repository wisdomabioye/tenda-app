import { LOCATIONS, SUPPORTED_PAYOUT_COUNTRIES, isCountryCode } from '@tenda/shared'

/**
 * ISO country codes → the names people read.
 *
 * An unknown code is shown as-is rather than dropped: the two country
 * registries are independent, so a payout market added without a matching
 * location entry should degrade to "GH" and not to a gap in a sentence.
 */
export function marketNames(codes: readonly string[]): string[] {
  return codes.map((code) => (isCountryCode(code) ? LOCATIONS[code].name : code))
}

/**
 * The countries someone can actually take money out in, by name.
 *
 * Two different country vocabularies exist and they are NOT the same list:
 * `LOCATIONS` is where a gig may be POSTED (ten markets — what the feed's
 * country filter offers and what the server validates against), while the
 * payout registry is where a worker can CASH OUT (three). Copy that names
 * countries almost always means the second one, and saying "we operate in
 * Nigeria, Kenya and Ghana" while accepting gigs in seven more would be wrong
 * in the direction that costs someone a wasted signup.
 */
export function payoutMarketNames(): string[] {
  return marketNames(SUPPORTED_PAYOUT_COUNTRIES)
}
