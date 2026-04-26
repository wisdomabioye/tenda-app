/**
 * §03 Two products — copy block lifted verbatim from
 * Tenda V2/landing/sections/03-two-products.html. Both panels share the same
 * shape so the eye reads them as siblings; only the verb-phrase italic, icon,
 * and accent colour differ.
 */

import { SUPPORTED_CURRENCIES } from '@/data/currencies'
import { GIG_CATEGORIES } from '@/data/categories'

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
    body: 'Post or accept tasks — delivery, photo, errands, services, digital. Funds lock when a gig is posted. Workers submit photo or video proof. Approval releases SOL on the spot.',
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
    headline: { lead: 'SOL ↔ local cash,', emphasis: 'without the middle.' },
    body: 'List or accept SOL ↔ fiat offers across NGN, GHS, KES, ZAR, PHP, USD, GBP, EUR. Pay via bank transfer or mobile money. Escrow only releases when both sides confirm.',
    link: { label: 'Open the exchange', href: '/#download' },
    statsLabel: `${SUPPORTED_CURRENCIES.length} markets`,
    statsValue: SUPPORTED_CURRENCIES.join(' · '),
    accent: 'accent',
  },
] as const

export const TWO_PRODUCTS_BRIDGE = {
  prefix: 'Same wallet',
  middle: 'Same escrow',
  emphasis: 'One app',
} as const

/** Sample gigs surfaced on the gigs panel (3 distinct categories). */
export const GIG_PANEL_SAMPLE_IDS = ['g-1', 'g-2', 'g-3'] as const

/** Sample offer surfaced on the exchange panel — references mock-feed by id. */
export const OFFER_PANEL_SAMPLE_ID = 'o-1' as const
