import type { GigStatus } from '@tenda/shared'
import type { AppTheme } from '@/theme/themes'

export const URGENT_HOURS = 24

export const STATUS_LABEL: Record<GigStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  accepted: 'Accepted',
  submitted: 'Submitted',
  completed: 'Completed',
  disputed: 'Disputed',
  resolved: 'Resolved',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export function STATUS_DOT_COLOR(theme: AppTheme, status: GigStatus): string {
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
