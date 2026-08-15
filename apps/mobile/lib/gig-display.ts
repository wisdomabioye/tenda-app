/**
 * Everything display-rule-shaped moved to @tenda/shared/utils/gig-display
 * (2026-08-15) so mobile and web share one set of status/deadline rules.
 * Only this stays: it takes the MOBILE theme object, which web does not have.
 */
import type { AppTheme } from '@/theme/themes'
import type { EscrowStatus } from '@tenda/shared'

/** Resolved hex color for status dots in card compositions (GigCardCompact). */
export function statusDotColor(theme: AppTheme, status: EscrowStatus): string {
  switch (status) {
    case 'open':
    case 'completed':
    case 'resolved':
      return theme.colors.feedback.success.base
    case 'accepted':
      return theme.colors.brand.primary
    case 'submitted':
      return theme.colors.feedback.warning.base
    case 'disputed':
      return theme.colors.feedback.danger.base
    default:
      return theme.colors.content.tertiary
  }
}
