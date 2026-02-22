/**
 * Frontend-only display helpers for gig deadlines.
 * Locale formatting is frontend-only; pure logic belongs in @tenda/shared/utils/gig-utils.
 */

export function deadlineLabel(deadline: Date | null): string {
  if (!deadline) return ''

  const now = new Date()
  if (deadline < now) return 'Expired'

  const diffMs = deadline.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Tomorrow'
  return `${diffDays} days left`
}
