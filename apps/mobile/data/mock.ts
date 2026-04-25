import type { GigCategory } from '@tenda/shared'

// ── Category metadata ─────────────────────────────────────────────────

export interface CategoryMeta {
  key: GigCategory
  label: string
  icon: string // lucide icon name
  colorToken: keyof typeof categoryColorTokens
}

const categoryColorTokens = {
  delivery: 'categoryDelivery',
  photo: 'categoryPhoto',
  errand: 'categoryErrand',
  service: 'categoryService',
  digital: 'categoryDigital',
} as const

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'delivery', label: 'Delivery', icon: 'Truck', colorToken: 'delivery' },
  { key: 'photo', label: 'Photo', icon: 'Camera', colorToken: 'photo' },
  { key: 'errand', label: 'Errand', icon: 'ShoppingBag', colorToken: 'errand' },
  { key: 'service', label: 'Service', icon: 'Wrench', colorToken: 'service' },
  { key: 'digital', label: 'Digital', icon: 'Monitor', colorToken: 'digital' },
]

export function getCategoryColor(category: GigCategory): string {
  return categoryColorTokens[category] ?? 'categoryService'
}

// Status label + tone mappings live in @/lib/gig-display
export { STATUS_BADGE_VARIANT, STATUS_LABEL } from '@/lib/gig-display'
