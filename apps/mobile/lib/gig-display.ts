/**
 * Frontend-only display helpers for gigs:
 *   - Date / duration / deadline formatters
 *   - Status label + status-tone mappings (single source of truth used by
 *     GigStatusBadge, GigCardCompact (Rich/PriceLeading/Classic), and any
 *     other surface that needs to display a gig status)
 *
 * Locale formatting is frontend-only; pure logic belongs in @tenda/shared/utils/gig-utils.
 */
import type { AppTheme } from '@/theme/themes'
import type { Gig, GigStatus } from '@tenda/shared'
import { formatRelativeShort } from './date'

/** Threshold below which a deadline chip switches to the urgent (warn) tone. */
export const URGENT_HOURS = 2

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

/** Tone slot for the Badge primitive (`<Badge variant={...} />`). */
export const STATUS_BADGE_VARIANT: Record<GigStatus, 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'accent' | 'neutral'> = {
  draft:     'neutral',
  open:      'success',
  accepted:  'brand',
  submitted: 'warning',
  completed: 'success',
  disputed:  'danger',
  resolved:  'success',
  expired:   'neutral',
  cancelled: 'neutral',
}

/** Resolved hex color for status dots in card compositions (GigCardCompact). */
export function statusDotColor(theme: AppTheme, status: GigStatus): string {
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

/**
 * Format a positive ms duration as a compact countdown:
 *   45m · 1h 10m · 4h · 22h · 3d
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return ''
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 24) {
    const remMin = Math.floor((ms - hours * 3_600_000) / 60_000)
    if (hours < 2 && remMin > 0) return `${hours}h ${remMin}m`
    return `${hours}h`
  }
  const days = Math.floor(ms / 86_400_000)
  return `${days}d`
}

export type GigDeadlineGlyph = 'clock' | 'check' | null
export type GigDeadlineTone  = 'neutral' | 'urgent' | 'success'

export interface GigDeadlineMeta {
  /** Human label for the chip (e.g. "45m left", "22h to review", "Draft", "3d ago"). */
  label: string
  /** Leading glyph hint (consumer renders the matching lucide icon). */
  glyph: GigDeadlineGlyph
  /** Visual tone — drives chip background + foreground. */
  tone: GigDeadlineTone
}

interface GigDeadlineOpts {
  /**
   * Live grace period from {@link usePlatformConfigStore} — the poster's review
   * window after a submission. Required for the `submitted` state to render
   * "Xh to review"; if omitted, that chip is hidden until the config loads.
   */
  gracePeriodSeconds?: number
}

/**
 * Resolve the deadline-chip presentation for a gig in any status.
 * Single source of truth used by GigCardCompact (Rich/PriceLeading/Classic).
 *
 *   open      → "45m left" / "4h left" / "Tomorrow" (urgent < {@link URGENT_HOURS})
 *   accepted  → "1h 10m"   / "Xh"       (completion countdown, urgent < URGENT_HOURS)
 *   submitted → "22h to review"          (poster review window, updated_at + grace)
 *   draft     → "Draft"                  (no countdown, neutral chip)
 *   expired   → "Expired"                (neutral)
 *   completed → "3d ago"                 (success, check glyph, relative past)
 *   resolved  → "3d ago"                 (success, like completed)
 *   disputed  → "Support open"           (neutral chip)
 *   cancelled → ""                       (no chip)
 */
export function gigDeadlineMeta(
  gig: Pick<Gig, 'status' | 'accept_deadline' | 'accepted_at' | 'completion_duration_seconds' | 'updated_at'>,
  opts: GigDeadlineOpts = {},
): GigDeadlineMeta {
  const now = Date.now()

  switch (gig.status) {
    case 'draft':
      return { label: 'Draft', glyph: 'clock', tone: 'neutral' }

    case 'expired':
      return { label: 'Expired', glyph: 'clock', tone: 'neutral' }

    case 'cancelled':
      return { label: 'Cancelled', glyph: null, tone: 'neutral' }

    case 'disputed':
      return { label: 'Support open', glyph: 'clock', tone: 'neutral' }

    case 'completed':
    case 'resolved': {
      const closedAt = gig.updated_at ? new Date(gig.updated_at) : null
      const ago = closedAt ? formatRelativeShort(closedAt) : ''
      return { label: ago, glyph: 'check', tone: 'success' }
    }

    case 'open': {
      if (!gig.accept_deadline) return { label: '', glyph: null, tone: 'neutral' }
      const deadline = new Date(gig.accept_deadline)
      const diffMs = deadline.getTime() - now
      if (diffMs <= 0) return { label: 'Expired', glyph: 'clock', tone: 'neutral' }
      const urgent = diffMs / 3_600_000 < URGENT_HOURS
      return { label: `${formatCountdown(diffMs)} left`, glyph: 'clock', tone: urgent ? 'urgent' : 'neutral' }
    }

    case 'accepted': {
      if (!gig.accepted_at) return { label: '', glyph: null, tone: 'neutral' }
      const completionAt = new Date(gig.accepted_at).getTime() + gig.completion_duration_seconds * 1000
      const diffMs = completionAt - now
      if (diffMs <= 0) return { label: 'Overdue', glyph: 'clock', tone: 'urgent' }
      const urgent = diffMs / 3_600_000 < URGENT_HOURS
      return { label: formatCountdown(diffMs), glyph: 'clock', tone: urgent ? 'urgent' : 'neutral' }
    }

    case 'submitted': {
      // Hide the chip until the platform config has loaded — we refuse to
      // guess the review window.
      if (opts.gracePeriodSeconds == null) return { label: '', glyph: null, tone: 'neutral' }
      // Approximation: status transition to 'submitted' bumps updated_at, so
      // updated_at + grace is a close proxy for the review deadline. Once a
      // dedicated `submitted_at` column exists, swap it in here.
      const base = gig.updated_at ? new Date(gig.updated_at).getTime() : now
      const reviewBy = base + opts.gracePeriodSeconds * 1000
      const diffMs = reviewBy - now
      if (diffMs <= 0) return { label: 'Review overdue', glyph: 'clock', tone: 'urgent' }
      const urgent = diffMs / 3_600_000 < URGENT_HOURS
      return { label: `${formatCountdown(diffMs)} to review`, glyph: 'clock', tone: urgent ? 'urgent' : 'neutral' }
    }
  }
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
