'use client'

import { displayName, winnerLabel, type DisputeSummary } from '@tenda/shared'
import { Badge } from '@/components/ui/badge'

/** Segment separator, e.g. "claimed · Ada Admin". */
const SEGMENT = ' · '

const UNCLAIMED_LABEL = 'unclaimed'
const MINE_LABEL = 'mine'
const CLAIMED_LABEL = 'claimed'
const RESOLVED_LABEL = 'resolved'

interface AssigneeBadgeProps {
  dispute: DisputeSummary
  /** Signed-in admin — their own caseload reads first-person, not by name. */
  meId: string
}

/**
 * The one status badge for a dispute: resolved outcome, the open pool, my
 * caseload, or WHICH colleague is mediating. Single source so the queue table
 * and the detail header cannot drift apart, and so names are derived through
 * the shared helpers rather than formatted at two call sites.
 */
export function AssigneeBadge({ dispute, meId }: AssigneeBadgeProps) {
  if (dispute.resolved_at !== null) {
    // Outcome copy is kind-aware and derived, never the raw structural enum.
    // No resolver name: nothing populates disputes.resolved_by (see the note
    // on DisputeSummary), so rendering it would only ever print a fallback.
    const outcome = dispute.winner === null ? null : winnerLabel(dispute.kind, dispute.winner)
    const label = outcome === null ? RESOLVED_LABEL : `${RESOLVED_LABEL}${SEGMENT}${outcome}`
    return <Badge variant="default">{label}</Badge>
  }

  if (dispute.assigned_to_id === null) return <Badge variant="outline">{UNCLAIMED_LABEL}</Badge>
  if (dispute.assigned_to_id === meId) return <Badge>{MINE_LABEL}</Badge>

  const mediator = displayName(
    dispute.assigned_to_first_name,
    dispute.assigned_to_last_name,
    dispute.assigned_to_id,
  )
  return <Badge variant="secondary">{`${CLAIMED_LABEL}${SEGMENT}${mediator}`}</Badge>
}
