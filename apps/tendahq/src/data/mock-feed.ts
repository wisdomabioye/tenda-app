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

export type TickerEvent = 'settled' | 'locked' | 'approved' | 'proof' | 'disputed'

export interface TickerRow {
  id: string
  event: TickerEvent
  /** Human-readable e.g. "now", "2s ago", "1m ago". */
  timestamp: string
  /** Category chip label (DEL / PHOTO / SVC / ERR / EXCHG). */
  category: string
  /** Right side of the context column — gig title or "@a → @b". */
  context: string
  amountSol: number
  /** Set on exchange settlements — pair line "SOL ↔ X CCY". */
  fiat?: { amount: number; currency: CurrencyCode }
  /** Otherwise this becomes "fee 0.0125" or "cid bafy…q9w". */
  pairExtra?: { label: 'fee' | 'cid'; value: string }
  /** Region cell — flag emoji + city + optional corridor (`bank`, `mobile money`). */
  region: { flag: string; city: string; corridor?: string }
  /** Truncated tx signature. */
  txShort: string
  /** Latest row glows green-edge. */
  fresh?: boolean
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

/**
 * §02 Trust strip — running settlement feed.
 * Verbs: 'released' (green) · 'locked' (brand blue) · 'disputed' (warning orange).
 * Replace with /v1/public/feed/live when M77 lands; row shape designed to map 1:1.
 */
export interface ProofFeedRow {
  id: string
  verb: 'released' | 'locked' | 'disputed'
  amountSol: number
  /** "@yemi → poster", "@chiamaka offered", "@kimani → @maina" */
  who: string
  /** Truncated tx signature, e.g. "5kJ2…b9q1". */
  sig: string
  /** Human relative time, e.g. "12s ago". */
  ago: string
  /** Present on exchange-typed events — surfaces fiat-side amount next to SOL. */
  fiat?: { amount: number; currency: CurrencyCode }
}

export const MOCK_PROOF_FEED: readonly ProofFeedRow[] = [
  { id: 'p-1', verb: 'released', amountSol: 0.500, who: '@yemi → poster',     sig: '5kJ2…b9q1', ago: '12s ago' },
  { id: 'p-2', verb: 'locked',   amountSol: 2.000, who: '@chiamaka offered',  sig: '7Lp3…f2d8', ago: '38s ago', fiat: { amount: 490_000, currency: 'NGN' } },
  { id: 'p-3', verb: 'released', amountSol: 1.200, who: '@kimani → @maina',   sig: '9Wq8…a3c2', ago: '1m ago'  },
  { id: 'p-4', verb: 'locked',   amountSol: 5.500, who: '@kwame offered',     sig: '2Hn4…e7b5', ago: '2m ago',  fiat: { amount: 1_925,   currency: 'GHS' } },
  { id: 'p-5', verb: 'released', amountSol: 0.850, who: '@thandi → @lebo',    sig: '4Mr1…c5a9', ago: '3m ago'  },
  { id: 'p-6', verb: 'released', amountSol: 0.300, who: '@rashim → @noor',    sig: '6Yt5…d8f3', ago: '4m ago'  },
  { id: 'p-7', verb: 'locked',   amountSol: 1.100, who: '@ada offered',       sig: '3Bx7…h2j6', ago: '5m ago',  fiat: { amount: 95,       currency: 'EUR' } },
  { id: 'p-8', verb: 'disputed', amountSol: 0.450, who: '@tunde · review',    sig: '8Vk0…m9n4', ago: '6m ago'  },
] as const

export const MOCK_TICKER_ROWS: TickerRow[] = [
  { id: 't-1',  event: 'settled',  timestamp: 'now',    category: 'EXCHG', context: '@adaeze → @kunle',                   amountSol: 2.000, fiat: { amount: 490_000, currency: 'NGN' }, region: { flag: '🇳🇬', city: 'Lagos',     corridor: 'bank' }, txShort: '5Qf…aL2', fresh: true },
  { id: 't-2',  event: 'locked',   timestamp: '2s ago', category: 'DEL',   context: 'Drop laptop · Yaba → Surulere',       amountSol: 0.50,  pairExtra: { label: 'fee', value: '0.0125' },    region: { flag: '🇳🇬', city: 'Lagos' },                       txShort: '9Tk…rNx' },
  { id: 't-3',  event: 'approved', timestamp: '7s ago', category: 'SVC',   context: 'Fix bathroom faucet leak · @rashim',  amountSol: 0.80,  pairExtra: { label: 'fee', value: '0.0200' },    region: { flag: '🇰🇪', city: 'Nairobi' },                     txShort: '3Mw…pXq' },
  { id: 't-4',  event: 'proof',    timestamp: '14s ago',category: 'PHOTO', context: 'Event photos · 2hr shoot',             amountSol: 1.20,  pairExtra: { label: 'cid', value: 'bafy…q9w' },  region: { flag: '🇬🇭', city: 'Accra' },                       txShort: '7Pa…eN3' },
  { id: 't-5',  event: 'settled',  timestamp: '22s ago',category: 'EXCHG', context: '@maya → @bongani',                    amountSol: 0.500, fiat: { amount: 1_720,   currency: 'ZAR' }, region: { flag: '🇿🇦', city: 'Cape Town', corridor: 'bank' }, txShort: '2Hb…yKd' },
  { id: 't-6',  event: 'locked',   timestamp: '31s ago',category: 'ERR',   context: 'Pickup groceries from Shoprite',      amountSol: 0.18,  pairExtra: { label: 'fee', value: '0.0045' },    region: { flag: '🇰🇪', city: 'Nairobi' },                     txShort: '8Yz…cM1' },
  { id: 't-7',  event: 'approved', timestamp: '48s ago',category: 'DIG',   context: 'Edit 90-second product reel',         amountSol: 1.50,  pairExtra: { label: 'fee', value: '0.0375' },    region: { flag: '🇳🇬', city: 'Lagos' },                       txShort: '4Lv…sQ7' },
  { id: 't-8',  event: 'settled',  timestamp: '1m ago', category: 'EXCHG', context: '@noah → @lerato',                     amountSol: 1.500, fiat: { amount: 230,     currency: 'USD' }, region: { flag: '🇺🇸', city: 'Remote',    corridor: 'wise' }, txShort: '6Wd…tJ5' },
  { id: 't-9',  event: 'proof',    timestamp: '1m ago', category: 'DEL',   context: 'Deliver invitation cards · Yaba',     amountSol: 0.30,  pairExtra: { label: 'cid', value: 'bafy…m3p' },  region: { flag: '🇳🇬', city: 'Lagos' },                       txShort: '1Kg…aE8' },
  { id: 't-10',event: 'locked',   timestamp: '2m ago', category: 'EXCHG', context: '@kwabena offered',                    amountSol: 3.20,  fiat: { amount: 4_320,   currency: 'GHS' }, region: { flag: '🇬🇭', city: 'Accra',     corridor: 'momo' }, txShort: '7Bn…hT4' },
]
