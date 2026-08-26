/**
 * Example P2P exchange corridors surfaced by the TradeDeck — each row is one
 * "crypto → local cash" movement: the asset side (what's locked in escrow, on
 * which chain) and the fiat side (what the counterparty receives, over which
 * payout rail).
 *
 * TWO RULES, both learned the hard way:
 *
 *   1. Only currencies an offer can actually be denominated in may appear —
 *      the payout registry's, i.e. NGN, KES and GHS. These rows read as
 *      product screenshots, so a ZAR or PHP row is a promise the Exchange will
 *      refuse the moment someone tries it.
 *   2. Rails stay GENERIC — "Bank transfer", "Mobile money". Tenda integrates
 *      no payment provider: it stores the account details a user types in and
 *      the two parties settle between themselves. Naming M-Pesa, OPay, GCash,
 *      Wise or SEPA implies an integration that does not exist, and only
 *      Ghana has a mobile-money rail at all.
 *
 * EDIT THIS FILE to add or change showcased corridors, within those rules.
 */

import type { CurrencyCode } from '@/data/currencies'

export type TradeAssetSymbol = 'USDC' | 'SOL' | 'ETH'

/** The only rail labels that describe what actually happens. */
export type TradeRail = 'Bank transfer' | 'Mobile money'

export interface ExampleTrade {
  id: string
  /** What's locked in escrow. */
  asset: {
    symbol: TradeAssetSymbol
    /** Display amount, pre-formatted (kept as string for exact rendering). */
    amount: string
    /** Manifest family of the chain the asset moves on. */
    chainFamily: 'solana' | 'base' | 'celo'
  }
  /** What the counterparty receives. */
  fiat: {
    /** Must be a payout-registry currency — see rule 1 above. */
    currency: Extract<CurrencyCode, 'NGN' | 'KES' | 'GHS'>
    amount: number
    rail: TradeRail
  }
  trader: string
  rating: number
}

export const EXAMPLE_TRADES: readonly ExampleTrade[] = [
  { id: 'x-01', asset: { symbol: 'USDC', amount: '120',  chainFamily: 'solana' }, fiat: { currency: 'NGN', amount: 187_200, rail: 'Bank transfer' }, trader: '@chiamaka', rating: 4.9 },
  { id: 'x-02', asset: { symbol: 'SOL',  amount: '0.80', chainFamily: 'solana' }, fiat: { currency: 'KES', amount: 18_300,  rail: 'Bank transfer' }, trader: '@kimani',   rating: 4.95 },
  { id: 'x-03', asset: { symbol: 'USDC', amount: '250',  chainFamily: 'celo' },   fiat: { currency: 'GHS', amount: 3_950,   rail: 'Mobile money' },  trader: '@kwabena',  rating: 4.7 },
  { id: 'x-04', asset: { symbol: 'ETH',  amount: '0.15', chainFamily: 'base' },   fiat: { currency: 'NGN', amount: 673_900, rail: 'Bank transfer' }, trader: '@noah',     rating: 4.8 },
  { id: 'x-05', asset: { symbol: 'USDC', amount: '400',  chainFamily: 'base' },   fiat: { currency: 'GHS', amount: 6_320,   rail: 'Bank transfer' }, trader: '@thandi',   rating: 4.85 },
  { id: 'x-06', asset: { symbol: 'USDC', amount: '75',   chainFamily: 'solana' }, fiat: { currency: 'KES', amount: 10_900,  rail: 'Bank transfer' }, trader: '@maria',    rating: 4.9 },
  { id: 'x-07', asset: { symbol: 'ETH',  amount: '0.25', chainFamily: 'base' },   fiat: { currency: 'GHS', amount: 11_400,  rail: 'Mobile money' },  trader: '@femi',     rating: 4.75 },
  { id: 'x-08', asset: { symbol: 'USDC', amount: '300',  chainFamily: 'celo' },   fiat: { currency: 'NGN', amount: 468_000, rail: 'Bank transfer' }, trader: '@ada',      rating: 5.0 },
  { id: 'x-09', asset: { symbol: 'SOL',  amount: '2.00', chainFamily: 'solana' }, fiat: { currency: 'NGN', amount: 490_000, rail: 'Bank transfer' }, trader: '@yemi',     rating: 4.9 },
  { id: 'x-10', asset: { symbol: 'USDC', amount: '90',   chainFamily: 'solana' }, fiat: { currency: 'KES', amount: 13_100,  rail: 'Bank transfer' }, trader: '@maina',    rating: 4.8 },
] as const
