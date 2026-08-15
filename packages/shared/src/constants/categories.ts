export const GIG_CATEGORIES = [
  'delivery',
  'photo',
  'errand',
  'service',
  'digital',
] as const

export type GigCategory = (typeof GIG_CATEGORIES)[number]

/**
 * Product-wide display labels for gig categories — shared so mobile and web
 * cannot label the same category differently ('photo' reads "Creative" on
 * purpose). Icon NAMES are shared too (CATEGORY_META below); only the
 * name→component resolution is per-client, because lucide import paths
 * differ by platform.
 */
export const CATEGORY_LABELS: Record<GigCategory, string> = {
  delivery: 'Delivery',
  photo:    'Creative',
  errand:   'Errand',
  service:  'Service',
  digital:  'Digital',
}

// ── Category display registry ─────────────────────────────────────────

export type CategoryColorToken =
  | 'categoryDelivery'
  | 'categoryPhoto'
  | 'categoryErrand'
  | 'categoryService'
  | 'categoryDigital'

export interface CategoryMeta {
  key: GigCategory
  label: string
  /** Lucide icon NAME — each client resolves it against its own lucide package. */
  icon: string
  colorToken: CategoryColorToken
}

/**
 * Display registry for gig categories (feed grid, cards, detail body, filter
 * sheets — mobile AND web). Labels come from CATEGORY_LABELS above so a
 * category can never read differently across surfaces again: before this
 * consolidation mobile shipped BOTH 'Photo' (cards/filters, via its local
 * lib/categories.ts) and 'Creative' (the create-flow CategoryGrid) for the
 * same category.
 *
 * Icons are the LIGHTER lucide glyphs on purpose (user decision 2026-08-15):
 * the product is micro-tasks, so 'Bike' not 'Truck', 'Laptop' not 'Monitor'.
 * Clients resolve these names against their own lucide package and must fail
 * loudly on an unmapped name rather than falling back silently.
 */
export const CATEGORY_META: CategoryMeta[] = [
  { key: 'delivery', label: CATEGORY_LABELS.delivery, icon: 'Bike', colorToken: 'categoryDelivery' },
  { key: 'photo', label: CATEGORY_LABELS.photo, icon: 'Camera', colorToken: 'categoryPhoto' },
  { key: 'errand', label: CATEGORY_LABELS.errand, icon: 'ShoppingBag', colorToken: 'categoryErrand' },
  { key: 'service', label: CATEGORY_LABELS.service, icon: 'Wrench', colorToken: 'categoryService' },
  { key: 'digital', label: CATEGORY_LABELS.digital, icon: 'Laptop', colorToken: 'categoryDigital' },
]
