/**
 * §03 Two products — both panels share the same shape so the eye reads them
 * as siblings; only the verb-phrase italic, icon, and accent colour differ.
 */

import { GIG_CATEGORIES } from '@/data/categories'
import { TRADE_COUNTRIES_PROSE, TRADE_CURRENCIES, TRADE_MARKET_COUNT } from '@/content'

export interface ProductPanel {
  id: 'gigs' | 'exchange'
  /** Lucide icon name. */
  icon: 'Briefcase' | 'ArrowLeftRight'
  eyebrow: string
  name: string
  headline: { lead: string; emphasis: string }
  body: string
  link: { label: string; href: string }
  /** Mono one-liner under the link, e.g. "5 categories · …" */
  statsLabel: string
  statsValue: string
  /** Token name used by the panel — see CSS vars in index.css. */
  accent: 'brand' | 'accent'
}

export const PRODUCT_PANELS: readonly ProductPanel[] = [
  {
    id: 'gigs',
    icon: 'Briefcase',
    eyebrow: 'Marketplace · Gigs',
    name: 'tenda / gigs',
    headline: { lead: 'Gigs that pay', emphasis: 'on proof.' },
    body: 'Post or accept tasks — delivery, photo, errands, services, digital. Funds lock when a gig is posted. Workers submit photo or video proof. Approval releases the USDC on the spot.',
    link: { label: 'Browse gigs in the app', href: '/#download' },
    statsLabel: `${GIG_CATEGORIES.length} categories`,
    statsValue: GIG_CATEGORIES.join(' · '),
    accent: 'brand',
  },
  {
    id: 'exchange',
    icon: 'ArrowLeftRight',
    eyebrow: 'P2P trade · Exchange',
    name: 'tenda / exchange',
    headline: { lead: 'Crypto ↔ local cash,', emphasis: 'without the middle.' },
    body: `Trade USDC, SOL or ETH for local cash in ${TRADE_COUNTRIES_PROSE}. You and your counterparty settle over whatever rail you both use — bank transfer or mobile money — and the escrow only releases when the trade completes. Tenda never touches the cash.`,
    link: { label: 'Open the exchange', href: '/#download' },
    statsLabel: `${TRADE_MARKET_COUNT} markets`,
    statsValue: TRADE_CURRENCIES.join(' · '),
    accent: 'accent',
  },
] as const

export const TWO_PRODUCTS_BRIDGE = {
  prefix: 'Same wallet',
  middle: 'Same escrow',
  emphasis: 'One app',
} as const

/**
 * Label above the currency marquee. Names it as a rate display so the eight
 * flags below it are not read as eight tradable markets — see CurrencyMarquee.
 */
export const RATES_CAPTION = 'Reference rates · view your balance in any of these'

/** Caption under the exchange panel's trade deck. */
export const TRADE_DECK_CAPTION = 'Example corridors · crypto in escrow, cash out local'

/** How many example gigs the gigs panel lists. */
export const GIG_PANEL_ROWS = 3
