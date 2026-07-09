import type { EscrowStatus } from '../types/escrow'

/**
 * Client-side action-visibility helpers over the v2 escrow shape
 * (creator/counterparty vocabulary — gigs and exchanges alike). These
 * mirror, but never replace, the server's lib/escrow.ts state machine:
 * the server re-checks every transition.
 *
 * Structural param types keep them usable with both wire projections
 * (ISO strings) and Drizzle rows.
 */

interface EscrowParties {
  creator_id: string
  counterparty_id: string | null
}

type EscrowLike = EscrowParties & { status: EscrowStatus }

function isParty(e: EscrowParties, userId: string): boolean {
  return userId === e.creator_id || userId === e.counterparty_id
}

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
  return pick === null ? null : new Date(pick)
}

export function canPublish(e: EscrowLike, userId: string): boolean {
  return e.status === 'draft' && userId === e.creator_id
}

export function canAccept(e: EscrowLike, userId: string): boolean {
  return e.status === 'open' && userId !== e.creator_id
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
  return e.approval_deadline !== null && now > new Date(e.approval_deadline)
}
