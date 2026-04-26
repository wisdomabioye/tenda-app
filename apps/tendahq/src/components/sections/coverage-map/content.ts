/**
 * §07 Coverage — copy + structured data based on
 * Tenda V2/landing/sections/07-coverage.html, with three honesty corrections:
 *
 *   1. Sidebar's INR + BRL replaced with the real 8 currencies — sidebar then
 *      removed entirely (we're pre-launch, no per-market volume to rank).
 *   2. The fictional 30d-volume tiering (high/med/growing) was replaced with
 *      a two-status model: `pilot` (the team's home market) + `devnet`
 *      (everywhere else, technically supported).
 *   3. Footer stat numbers (Active corridors, New corridors/wk, Top corridor)
 *      removed — we have no public-launch data to show.
 */

import { CURRENCIES, type CurrencyCode } from '@/data/currencies'

/**
 * Pre-launch market status. We never ship liquidity claims because there is
 * no liquidity yet. `pilot` marks the team's home base; `devnet` marks every
 * other supported corridor (the code path works, awaiting first transactions).
 */
export type MarketStatus = 'pilot' | 'devnet'

export type LabelPlacement = 'right' | 'left' | 'above' | 'below'

export interface CoverageMarket {
  code: CurrencyCode
  country: string
  /** Representative city used as the map ping + label. */
  city: string
  /** Display label for the SVG hub rectangle (uppercase, short). */
  hubLabel: string
  /** Representative city lat/lon for the map ping. */
  lat: number
  lon: number
  status: MarketStatus
  /** Position of the label relative to the ping. Defaults to 'right'. */
  labelPlacement?: LabelPlacement
}

/**
 * NGN is the team's home market (APP_INFO.buildLocation === 'Lagos').
 * Every other corridor is `devnet` — supported in code, awaiting users.
 */
export const COVERAGE_MARKETS: readonly CoverageMarket[] = [
  { code: 'NGN', country: 'Nigeria',         city: 'Lagos',         hubLabel: 'LAGOS',     lat:   6.5, lon:    3.4, status: 'pilot'                              },
  { code: 'PHP', country: 'Philippines',     city: 'Manila',        hubLabel: 'MANILA',    lat:  14.6, lon:  121.0, status: 'devnet', labelPlacement: 'left'   },
  { code: 'KES', country: 'Kenya',           city: 'Nairobi',       hubLabel: 'NAIROBI',   lat:  -1.3, lon:   36.8, status: 'devnet'                            },
  // Accra label flipped LEFT — Lagos lat/lon nearly collides; with both labels going right they overlap.
  { code: 'GHS', country: 'Ghana',           city: 'Accra',         hubLabel: 'ACCRA',     lat:   5.6, lon:   -0.2, status: 'devnet', labelPlacement: 'left'   },
  { code: 'ZAR', country: 'South Africa',    city: 'Cape Town',     hubLabel: 'CAPE TOWN', lat: -26.2, lon:   28.0, status: 'devnet'                            },
  // London label flipped LEFT so the rectangle doesn't cover the Berlin dot.
  { code: 'GBP', country: 'United Kingdom',  city: 'London',        hubLabel: 'LONDON',    lat:  51.5, lon:   -0.1, status: 'devnet', labelPlacement: 'left'   },
  { code: 'USD', country: 'United States',   city: 'New York',      hubLabel: 'NYC',       lat:  40.7, lon:  -74.0, status: 'devnet'                            },
  { code: 'EUR', country: 'Eurozone',        city: 'Berlin',        hubLabel: 'BERLIN',    lat:  52.5, lon:   13.4, status: 'devnet'                            },
]

/**
 * Decorative scatter of background activity dots — keeps the map from feeling
 * empty. Not tied to any specific corridor; pure texture. Coords lifted from
 * the wireframe at the same SVG-viewBox (1600×800).
 */
export const CORRIDOR_DOTS: readonly { x: number; y: number; r: number; opacity: number }[] = [
  { x:  755, y: 430, r: 2.4, opacity: 0.85 },
  { x:  790, y: 440, r: 2.6, opacity: 0.95 },
  { x:  770, y: 425, r: 2.0, opacity: 0.7  },
  { x:  775, y: 415, r: 2.0, opacity: 0.65 },
  { x:  800, y: 425, r: 2.0, opacity: 0.7  },
  { x:  855, y: 490, r: 2.4, opacity: 0.9  },
  { x:  845, y: 475, r: 2.0, opacity: 0.65 },
  { x:  850, y: 510, r: 2.0, opacity: 0.7  },
  { x:  820, y: 610, r: 2.2, opacity: 0.85 },
  { x:  835, y: 595, r: 1.8, opacity: 0.6  },
  { x:  775, y: 335, r: 2.0, opacity: 0.7  },
  { x:  850, y: 320, r: 2.0, opacity: 0.65 },
  { x:  760, y: 215, r: 2.4, opacity: 0.9  },
  { x:  800, y: 225, r: 2.0, opacity: 0.7  },
  { x:  780, y: 200, r: 1.8, opacity: 0.6  },
  { x:  745, y: 250, r: 1.8, opacity: 0.6  },
  { x:  820, y: 245, r: 1.8, opacity: 0.55 },
  { x:  935, y: 295, r: 2.0, opacity: 0.7  },
  { x:  920, y: 320, r: 1.8, opacity: 0.6  },
  { x: 1290, y: 410, r: 2.0, opacity: 0.7  },
  { x: 1265, y: 410, r: 1.8, opacity: 0.6  },
  { x: 1250, y: 355, r: 1.8, opacity: 0.6  },
  { x: 1340, y: 390, r: 2.6, opacity: 0.95 },
  { x: 1340, y: 370, r: 2.0, opacity: 0.7  },
  { x: 1395, y: 260, r: 2.0, opacity: 0.7  },
  { x: 1340, y: 240, r: 1.8, opacity: 0.6  },
  { x:  280, y: 240, r: 2.4, opacity: 0.85 },
  { x:  320, y: 260, r: 2.0, opacity: 0.7  },
  { x:  220, y: 240, r: 1.8, opacity: 0.6  },
  { x:  395, y: 500, r: 2.2, opacity: 0.8  },
  { x:  380, y: 470, r: 1.8, opacity: 0.6  },
  { x:  380, y: 620, r: 1.8, opacity: 0.55 },
  { x: 1370, y: 565, r: 2.0, opacity: 0.7  },
  { x: 1400, y: 590, r: 1.8, opacity: 0.6  },
]

/**
 * Dashed corridor arcs between top hubs — pure decoration. SVG quadratic
 * Bézier paths in the 1600×800 viewBox.
 */
export const CORRIDOR_ARCS: readonly string[] = [
  'M790,440 Q1100,180 1340,390', // Lagos → Manila
  'M790,440 Q820,330 760,215',   // Lagos → London
  'M1340,390 Q1100,290 760,215', // Manila → London
  'M820,610 Q800,520 790,440',   // Cape Town → Lagos
  'M280,240 Q500,200 760,215',   // NYC → London
  'M790,440 Q830,460 855,490',   // Lagos → Nairobi
]

export const COVERAGE_HEADER = {
  eyebrow: { num: '§ 07', label: 'Coverage' },
  h2: {
    lead: 'Live',
    accent: 'wherever you are.',
    dim: 'Tenda runs on-chain — anyone can post or trade.',
  },
  sub: "Tenda isn't \"launched in N countries.\" The contract is on Solana, the app is in your pocket, and any of these corridors lights up the moment a buyer and a worker meet there.",
} as const

export const COVERAGE_MAP_LABELS = {
  path: 'tenda://',
  pathSuffix: 'corridors.devnet',
  legend: [
    { id: 'land',   label: 'Land' },
    { id: 'pilot',  label: 'Pilot · Lagos' },
    { id: 'devnet', label: 'Devnet · supported' },
  ] as const,
} as const

export const COVERAGE_FLOATING_LABEL = {
  eyebrowText: 'Solana · devnet',
  countSuffix: 'corridors supported',
} as const

/** Display labels — visible on the map legend, not used as filter pills. */
export const STATUS_LABEL: Record<MarketStatus, string> = {
  pilot:  'Pilot · Lagos',
  devnet: 'Devnet',
}

/** Lookup helper for any caller that needs the currency meta. */
export function getCurrencyMeta(code: CurrencyCode) {
  return CURRENCIES[code]
}
