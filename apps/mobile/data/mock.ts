import type { GigCategory, GigStatus } from '@tenda/shared'

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

export function getCategoryColor(category: string): string {
  return categoryColorTokens[category as GigCategory] ?? 'categoryService'
}

// ── Status → Badge variant mapping ────────────────────────────────────

export const STATUS_BADGE_VARIANT: Record<GigStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft:     'neutral',
  open:      'info',
  accepted:  'warning',
  submitted: 'warning',
  completed: 'success',
  disputed:  'danger',
  resolved:  'success',
  expired:   'neutral',
  cancelled: 'neutral',
}

export const STATUS_LABEL: Record<GigStatus, string> = {
  draft:     'Draft',
  open:      'Open',
  accepted:  'Accepted',
  submitted: 'Submitted',
  completed: 'Completed',
  disputed:  'Disputed',
  resolved:  'Resolved',
  expired:   'Expired',
  cancelled: 'Cancelled',
}
