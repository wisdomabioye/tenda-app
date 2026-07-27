/**
 * The gig detail projected onto the shapes the SHARED `can*` helpers take.
 *
 * One place builds it, so no branch of the CTA can forget the acceptance mode
 * and fall back to the mode-blind behaviour that offered "Accept Gig" on an
 * approval-mode gig — a button whose transaction both contracts revert.
 */
import type { GigDetail } from '@tenda/shared'

export function partiesOf(gig: GigDetail) {
  return {
    status: gig.status,
    creator_id: gig.creator.id,
    counterparty_id: gig.counterparty?.id ?? null,
    requires_approval: gig.requires_approval,
    assigned_counterparty_id: gig.assigned_counterparty_id,
  }
}

/** Adds the timing fields the approval-mode window helpers derive from. */
export function approvalContextOf(gig: GigDetail) {
  return {
    ...partiesOf(gig),
    accept_deadline: gig.accept_deadline,
    completion_deadline: gig.completion_deadline,
    completion_duration_seconds: gig.completion_duration_seconds,
    unassign_window_seconds: gig.unassign_window_seconds,
    assignment_released_at: gig.assignment_released_at,
  }
}
