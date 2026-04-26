/**
 * Static mock data used by §05 live ticker and the hero/two-products card stacks.
 * Replaced by /v1/public/feed/live when M77 is implemented. Do not display these
 * as if they were live — every consumer wraps them in <Placeholder> or labels them
 * "live · sample" in the UI.
 */

import type { CategoryId } from './categories'
import type { CurrencyCode } from './currencies'

export interface MockGigCard {
  id: string
  category: CategoryId
  title: string
  amountSol: number
  poster: string
  city: string
  countdown: string
}

export interface MockOfferCard {
  id: string
  side: 'buy' | 'sell'
  amountSol: number
  fiatAmount: number
  currency: CurrencyCode
  rate: number
  spreadPct: number
  paymentMethods: string[]
  trader: string
  trades: number
  rating: number
}

export interface TickerRow {
  id: string
  kind: 'gig-settled' | 'offer-published' | 'offer-settled'
  amountSol: number
  fiatAmount?: number
  currency?: CurrencyCode
  meta: string
  timestamp: string  // human-readable e.g. "12s ago"
}

export const MOCK_GIG_CARDS: MockGigCard[] = [
  { id: 'g-1', category: 'delivery', title: 'Pick up package · Lekki Phase 1',           amountSol: 0.50, poster: '@yemi',     city: 'Lagos',    countdown: '45m left' },
  { id: 'g-2', category: 'photo',    title: 'Event photographer · 2 hours',              amountSol: 1.20, poster: '@kimani',   city: 'Nairobi',  countdown: '4h left'  },
  { id: 'g-3', category: 'service',  title: 'Fix leaking kitchen faucet',                amountSol: 0.80, poster: '@rashim',   city: 'Accra',    countdown: '2d left'  },
  { id: 'g-4', category: 'errand',   title: 'Drop off documents · Sandton',              amountSol: 0.30, poster: '@thandi',   city: 'Johannesburg', countdown: '1h left' },
  { id: 'g-5', category: 'digital',  title: 'Edit a 90-second product reel',             amountSol: 1.50, poster: '@chiamaka', city: 'Lagos',    countdown: '6h left'  },
  { id: 'g-6', category: 'service',  title: 'Move a 2-seater couch to Yaba',             amountSol: 0.45, poster: '@tunde',    city: 'Lagos',    countdown: '30m left' },
]

export const MOCK_OFFER_CARDS: MockOfferCard[] = [
  { id: 'o-1', side: 'sell', amountSol: 2.00, fiatAmount: 490_000, currency: 'NGN', rate: 245_000, spreadPct: +1.2, paymentMethods: ['OPay', 'Kuda', 'MoMo'], trader: '@chiamaka', trades: 38,  rating: 4.9 },
  { id: 'o-2', side: 'buy',  amountSol: 1.50, fiatAmount: 230,     currency: 'USD', rate: 153.33,  spreadPct: -0.8, paymentMethods: ['Wise', 'Zelle'],         trader: '@noah',     trades: 112, rating: 4.8 },
  { id: 'o-3', side: 'sell', amountSol: 0.80, fiatAmount: 17_500,  currency: 'KES', rate: 21_875,  spreadPct: +0.4, paymentMethods: ['M-Pesa'],                trader: '@kimani',   trades: 64,  rating: 4.95 },
  { id: 'o-4', side: 'sell', amountSol: 3.20, fiatAmount: 4_320,   currency: 'GHS', rate: 1_350,   spreadPct: +1.8, paymentMethods: ['MoMo', 'Bank Transfer'], trader: '@kwabena',  trades: 21,  rating: 4.7 },
]

/**
 * Hero `EscrowWall` — 9 mini cards rendered in a 3×3 drifting 3D grid behind
 * the featured MockEscrowCard. Two variants: `exchange` (SOL → fiat) and
 * `gig` (category-led). Pulled directly from the wireframe markup in
 * Tenda V2/landing/sections/01-hero-final.html (lines 302–360).
 */

export interface EscrowMini {
  id: string
  status: 'locked' | 'open' | 'funding'
  timer: string
  amountSol: number
  category: CategoryId
  /** Present for exchange-variant cards. */
  arrow?: { fiatAmount: number; currency: CurrencyCode }
  who: string
}

export const ESCROW_WALL: readonly EscrowMini[] = [
  { id: 'w-1', status: 'locked',  timer: '02:14', amountSol: 2.00, category: 'delivery', arrow: { fiatAmount: 490_000, currency: 'NGN' }, who: '@chiamaka · 4.9★' },
  { id: 'w-2', status: 'open',    timer: '45m',   amountSol: 1.20, category: 'photo',                                                       who: '@kimani' },
  { id: 'w-3', status: 'funding', timer: '·',     amountSol: 0.50, category: 'service',  arrow: { fiatAmount: 122_500, currency: 'NGN' }, who: '@yemi' },
  { id: 'w-4', status: 'locked',  timer: '8h',    amountSol: 0.30, category: 'errand',                                                      who: '@rashim' },
  { id: 'w-5', status: 'locked',  timer: '19:58', amountSol: 0.85, category: 'delivery', arrow: { fiatAmount: 18_300,  currency: 'KES' }, who: '@maina' },
  { id: 'w-6', status: 'open',    timer: '2d',    amountSol: 3.00, category: 'digital',                                                     who: '@ada · 5.0★' },
  { id: 'w-7', status: 'locked',  timer: '11:42', amountSol: 5.50, category: 'service',  arrow: { fiatAmount: 1_925,   currency: 'GHS' }, who: '@kwame' },
  { id: 'w-8', status: 'open',    timer: '1h',    amountSol: 0.40, category: 'delivery',                                                    who: '@tunde' },
  { id: 'w-9', status: 'locked',  timer: '04:08', amountSol: 1.00, category: 'photo',    arrow: { fiatAmount: 18_000,  currency: 'ZAR' }, who: '@thandi' },
] as const

export const MOCK_TICKER_ROWS: TickerRow[] = [
  { id: 't-1',  kind: 'gig-settled',     amountSol: 0.50, meta: '📦 Lagos · @yemi → @ade',       timestamp: '12s ago' },
  { id: 't-2',  kind: 'offer-settled',   amountSol: 2.00, fiatAmount: 490_000, currency: 'NGN', meta: '🇳🇬 OPay · 30m window',          timestamp: '38s ago' },
  { id: 't-3',  kind: 'gig-settled',     amountSol: 1.20, meta: '📸 Nairobi · @kimani → @aisha', timestamp: '1m ago'  },
  { id: 't-4',  kind: 'offer-published', amountSol: 0.80, fiatAmount: 17_500,  currency: 'KES', meta: '🇰🇪 M-Pesa · awaiting buyer',    timestamp: '2m ago'  },
  { id: 't-5',  kind: 'gig-settled',     amountSol: 0.30, meta: '🏃 Sandton · @thandi → @sipho', timestamp: '3m ago'  },
  { id: 't-6',  kind: 'offer-settled',   amountSol: 3.20, fiatAmount: 4_320,   currency: 'GHS', meta: '🇬🇭 MoMo · settled',             timestamp: '4m ago'  },
  { id: 't-7',  kind: 'gig-settled',     amountSol: 1.50, meta: '💻 Lagos · @chiamaka → @femi',  timestamp: '5m ago'  },
  { id: 't-8',  kind: 'offer-settled',   amountSol: 0.50, fiatAmount: 76,       currency: 'USD', meta: '🇺🇸 Wise · settled',             timestamp: '6m ago'  },
  { id: 't-9',  kind: 'gig-settled',     amountSol: 0.45, meta: '🛠 Lagos · @tunde → @musa',     timestamp: '7m ago'  },
  { id: 't-10', kind: 'offer-published', amountSol: 1.10, fiatAmount: 95,       currency: 'EUR', meta: '🇪🇺 SEPA · awaiting buyer',      timestamp: '8m ago'  },
]
