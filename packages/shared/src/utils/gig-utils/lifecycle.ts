/**
 * Client-side action-visibility helpers over the v2 escrow shape
 * (creator/counterparty vocabulary — gigs and exchanges alike). These
 * mirror, but never replace, the server's lib/escrow.ts state machine:
 * the server re-checks every transition.
 */

import type { EscrowAcceptanceMode, EscrowLike } from './types'
import { isParty, toDate } from './types'

/**
 * Returns the most relevant deadline for an escrow given its status.
 * - open: accept_deadline (null if indefinitely open)
 * - accepted: completion_deadline (set at accept)
 * - submitted: approval_deadline (claim-stalled window)
 * - other: null
 */
export function computeRelevantDeadline(
  e: Pick<EscrowLike, 'status'> & {
    accept_deadline: string | Date | null
    completion_deadline: string | Date | null
    approval_deadline: string | Date | null
  },
): Date | null {
  const pick =
    e.status === 'open'
      ? e.accept_deadline
      : e.status === 'accepted'
        ? e.completion_deadline
        : e.status === 'submitted'
          ? e.approval_deadline
          : null
  return toDate(pick)
}

export function canPublish(e: EscrowLike, userId: string): boolean {
  return e.status === 'draft' && userId === e.creator_id
}

/**
 * Whether this user may send the `accept` transaction themselves.
 *
 * Mode-aware, and it has to be: both contracts reject an `acceptEscrow` on an
 * approval-mode escrow, and reject it from anyone but the named assignee on a
 * direct invite. Offering the button anyway costs the worker gas to discover a
 * revert, so the mode lives here rather than inline in each CTA.
 */
export function canAccept(e: EscrowLike & EscrowAcceptanceMode, userId: string): boolean {
  if (e.status !== 'open' || userId === e.creator_id) return false
  // Approval mode: the POSTER assigns. A worker applies instead (canApply).
  if (e.requires_approval) return false
  // Direct invite: the escrow names its worker, nobody else can take it.
  if (e.assigned_counterparty_id !== null) return e.assigned_counterparty_id === userId
  return true
}

export function canSubmit(e: EscrowLike, userId: string): boolean {
  return e.status === 'accepted' && e.counterparty_id === userId
}

/**
 * The counterparty (worker) may attach evidence while the poster reviews
 * (`submitted`) AND while the escrow is under dispute (`disputed`) — a
 * mediator often needs more proof mid-review, so the upload stays open until
 * the dispute resolves. Kept off-chain; it never changes the escrow status.
 */
export function canAddProof(e: EscrowLike, userId: string): boolean {
  return (e.status === 'submitted' || e.status === 'disputed') && e.counterparty_id === userId
}

export function canApprove(e: EscrowLike, userId: string): boolean {
  return e.status === 'submitted' && userId === e.creator_id
}

export function canDispute(e: EscrowLike, userId: string): boolean {
  return isParty(e, userId) && (e.status === 'accepted' || e.status === 'submitted')
}

export function canReview(e: EscrowLike, userId: string): boolean {
  return isParty(e, userId) && (e.status === 'completed' || e.status === 'resolved')
}

export function canCancel(e: EscrowLike, userId: string): boolean {
  return (e.status === 'draft' || e.status === 'open') && userId === e.creator_id
}

/**
 * Claim-stalled (counterparty, after approval_deadline passes with no
 * dispute). The server enforces the deadline on-chain; this only gates UI.
 */
export function canClaim(
  e: EscrowLike & { approval_deadline: string | Date | null },
  userId: string,
  now: Date = new Date(),
): boolean {
  if (e.status !== 'submitted' || e.counterparty_id !== userId) return false
  const deadline = toDate(e.approval_deadline)
  return deadline !== null && now > deadline
}
