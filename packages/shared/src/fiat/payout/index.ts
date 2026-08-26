import type { SupportedCurrency } from '../../constants/currencies'
import type { PayoutCountrySpec, PayoutRailKind, PayoutRailSpec } from './types'
import { NG_PAYOUT } from './ng'
import { KE_PAYOUT } from './ke'
import { GH_PAYOUT } from './gh'
import { ZA_PAYOUT } from './za'
import { PH_PAYOUT } from './ph'

export * from './types'
export { GH_MOMO_NETWORKS } from './gh'
export { PH_WALLET_NETWORKS } from './ph'

/**
 * The payout countries, keyed by ISO 3166-1 alpha-2.
 *
 * Adding a market is this entry plus one spec file — every downstream surface
 * derives: SUPPORTED_PAYOUT_COUNTRIES, PAYOUT_CURRENCIES, the mobile country
 * picker, the server's field validation, and the landing's market count.
 *
 * One country maps to exactly one currency, deliberately. A country that needs
 * two (a Nigerian holding both a naira account and a domiciliary dollar one)
 * would need the currency stored on `bank_accounts` rather than inferred from
 * the country — a schema change, not a spec file.
 */
export const PAYOUT_COUNTRY_SPECS: Readonly<Record<string, PayoutCountrySpec>> = {
  NG: NG_PAYOUT,
  KE: KE_PAYOUT,
  GH: GH_PAYOUT,
  ZA: ZA_PAYOUT,
  PH: PH_PAYOUT,
}

/** Supported payout country codes, in registry order. */
export const SUPPORTED_PAYOUT_COUNTRIES: string[] = Object.keys(PAYOUT_COUNTRY_SPECS)

/**
 * The fiat currencies payouts settle in — DERIVED from the country specs so it
 * can never drift from the countries we actually support. Drives both the p2p
 * exchange's enabled currencies and the offramp currency validation.
 */
export const PAYOUT_CURRENCIES: SupportedCurrency[] = [
  ...new Set(Object.values(PAYOUT_COUNTRY_SPECS).map((s) => s.currency)),
]

/** Country spec, or null when the country isn't a supported payout market. */
export function getPayoutSpec(country: string): PayoutCountrySpec | null {
  return PAYOUT_COUNTRY_SPECS[country] ?? null
}

/**
 * The single fiat currency payouts settle in for a country — `null` when the
 * country is not a payout market, or not known yet.
 *
 * THERE IS NO DEFAULT, deliberately. This used to fall back to NGN, which was
 * wrong in two directions at once. On the server it turned "this account is in
 * a country we don't serve" into "this account is Nigerian", so an unrecognised
 * country silently satisfied the guard on an NGN-priced offer instead of
 * failing it. On mobile it printed a currency next to an empty payout field, so
 * the composer showed NGN to a Kenyan until they picked an account.
 *
 * Under a strict one-country-one-currency model the account always knows the
 * answer, so a fallback can only ever be a guess — and every caller here is
 * better served by handling the absence: the guards reject, and the UI shows
 * nothing until a payout account is chosen.
 */
export function payoutCurrencyForCountry(country: string | null): SupportedCurrency | null {
  return (country !== null ? getPayoutSpec(country)?.currency : undefined) ?? null
}

/**
 * How a country is NAMED to a reader: the spec's name where we have one, the
 * raw ISO code otherwise, and null when the account carries no country at all.
 *
 * The code is deliberately not hidden behind a placeholder. A trader's country
 * is part of deciding whether to trade with them, and "—" says less than "ZW"
 * does to the person reading it.
 */
export function countryDisplayName(country: string | null): string | null {
  if (country === null || country === '') return null
  return getPayoutSpec(country)?.countryName ?? country
}

/** A specific rail (bank / mobile_money) for a country, or null if unsupported. */
export function getPayoutRail(country: string, kind: PayoutRailKind): PayoutRailSpec | null {
  return getPayoutSpec(country)?.rails.find((r) => r.kind === kind) ?? null
}
