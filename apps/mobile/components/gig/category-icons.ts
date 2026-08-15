import { Bike, Camera, Laptop, ShoppingBag, Wrench } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { CATEGORY_META, type GigCategory } from '@tenda/shared'

/**
 * The mobile resolution of shared CATEGORY_META icon NAMES to lucide
 * components. Built from the registry (not hand-keyed by category) so a
 * renamed icon in shared fails HERE at module load instead of drifting —
 * which is exactly how the old Truck/Monitor vs Bike/Laptop split survived:
 * the names lived in dead metadata nobody resolved.
 */
const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  Bike,
  Camera,
  ShoppingBag,
  Wrench,
  Laptop,
}

function resolveCategoryIcons(): Record<GigCategory, LucideIcon> {
  const icons = {} as Record<GigCategory, LucideIcon>
  for (const meta of CATEGORY_META) {
    const icon = LUCIDE_BY_NAME[meta.icon]
    if (icon === undefined) {
      throw new Error(
        `category-icons: no lucide mapping for "${meta.icon}" (category "${meta.key}") — add it to LUCIDE_BY_NAME`,
      )
    }
    icons[meta.key] = icon
  }
  return icons
}

export const CATEGORY_ICONS: Record<GigCategory, LucideIcon> = resolveCategoryIcons()
