/**
 * Frontend-only display helpers for gig dates, durations, and deadlines.
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

/** Format a date for display (weekday + day + month + year). */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a completion duration in seconds to a short human-readable string.
 * e.g. 3600 → "1h", 86400 → "1d", 90 → "2m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

/**
 * Format an accept_deadline for display.
 * Shows a time component (HH:MM) when the deadline is less than 24 hours away,
 * so users have the urgency context they need to act quickly.
 */
export function formatDeadline(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  const hoursUntil = (d.getTime() - Date.now()) / 3_600_000
  if (hoursUntil < 24) {
    return d.toLocaleString('en-NG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
