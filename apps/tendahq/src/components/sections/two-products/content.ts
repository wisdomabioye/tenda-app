/**
 * §03 Two products — both panels share the same shape so the eye reads them
 * as siblings; only the verb-phrase italic, icon, and accent colour differ.
 */

import { CATEGORY_LABELS_LINE, GIG_CATEGORIES } from '@/content/categories'
import {
  EXCHANGE_ASSET_SYMBOLS_PROSE,
  TRADE_COUNTRIES_PROSE,
  TRADE_CURRENCIES,
  TRADE_MARKET_COUNT,
} from '@/content'

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
    // Shared's LABELS, not the raw enum keys. The keys are a database
    // vocabulary ('photo'), and one of them does not even match its own label
    // — shared renders `photo` as "Creative" on purpose — so joining the keys
    // printed a word the apps deliberately do not use.
    statsValue: CATEGORY_LABELS_LINE,
    accent: 'brand',
  },
  {
    id: 'exchange',
    icon: 'ArrowLeftRight',
    eyebrow: 'P2P trade · Exchange',
    name: 'tenda / exchange',
    headline: { lead: 'Crypto ↔ local cash,', emphasis: 'without the middle.' },
    body: `Trade ${EXCHANGE_ASSET_SYMBOLS_PROSE} for local cash in ${TRADE_COUNTRIES_PROSE}. You and your counterparty settle over whatever rail you both use — bank transfer or mobile money — and the escrow only releases when the trade completes. Tenda never touches the cash.`,
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
 * Label above the currency marquee.
 *
 * It has to say TWO true things at once, and an earlier draft got the first
 * one wrong. The strip renders SOL priced in each currency — the server's
 * `/v1/platform/exchange-rates` is `getAssetRates('solana')`, nothing to do
 * with a wallet balance — so a caption promising "view your balance in these"
 * described a different feature than the one underneath it. And the strip sits
 * directly below an exchange panel advertising the tradable markets, so the
 * flags need naming as display currencies or they read as markets.
 *
 * Counts stay out of this comment: it named two ("three tradable markets",
 * "eight flags") and both went stale as markets and currencies were added.
 */
export const RATES_CAPTION = 'Live SOL price · shown in the currencies your balance can display in'

/** Caption under the exchange panel's trade deck. */
export const TRADE_DECK_CAPTION = 'Example corridors · crypto in escrow, cash out local'

/** How many example gigs the gigs panel lists. */
export const GIG_PANEL_ROWS = 3
