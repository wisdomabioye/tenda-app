/**
 * §03 Two products — both panels share the same shape so the eye reads them
 * as siblings; only the verb-phrase italic, icon, and accent colour differ.
 */

import {
  CATEGORY_LABELS_LINE,
  CATEGORY_LABELS_PROSE,
  GIG_CATEGORIES,
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
    // The category list is DERIVED. Hand-listed it read "delivery, photo,
    // errands, services, digital" — printing the enum key `photo` two lines
    // above a stat line that prints shared's label "Creative" for the same
    // category. One panel showing one category under two names is the split
    // CATEGORY_LABELS exists to prevent.
    body: `Post or accept tasks — ${CATEGORY_LABELS_PROSE}. Funds lock when a gig is posted. Workers submit photo or video proof. Approval releases the USDC on the spot.`,
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
 * Caption under the exchange panel's trade deck.
 *
 * It used to read "Example corridors · crypto in escrow, cash out local",
 * which described the mechanic but left the most misreadable thing unsaid: the
 * amounts on those cards divide out to an exchange rate, and a visitor reads
 * that as Tenda's rate. Tenda sets no rate and takes no spread on FX (see the
 * fee answer in the FAQ) — the seller prices their own offer. Saying so is the
 * half that was missing.
 */
export const TRADE_DECK_CAPTION = 'Example corridors · the seller sets the rate, not Tenda'

/** How many example gigs the gigs panel lists. */
export const GIG_PANEL_ROWS = 3
