/**
 * WHICH CTA a gig shows, as pure functions over the gig and the viewer.
 *
 * Separated from the rendering for two reasons. The honest one: the bar has to
 * know whether a branch exists before it renders a container, and asking a
 * component by calling it as a function runs its hooks in the parent's slots —
 * a real bug, not a style point. The useful one: every visibility rule is now
 * testable without rendering anything, which is where the interesting
 * behaviour lives.
 *
 * No rule is invented here. Each branch reads a SHARED `can*` helper, so this
 * file decides ordering and nothing else.
 */

import {
  canAccept,
  canAddProof,
  canApply,
  canAssign,
  canClaim,
  canReleaseAssignment,
  canReview,
  canSubmit,
  canUnassign,
  canWithdrawApplication,
  type GigDetail,
} from '@tenda/shared'
import { approvalContextOf, partiesOf } from './parties'

/** Approval-mode branches, most specific first. */
export type ApprovalBranch =
  /** Poster, gig open: go pick someone. */
  | 'assign'
  /** Poster, worker assigned, still inside the unassign window. */
  | 'unassign'
  /** Assigned worker: the free off-chain way out. */
  | 'release'
  /** Worker with a live application: wait, or pull it. */
  | 'withdraw'
  /** Worker who may raise their hand. */
  | 'apply'
  /** Worker whose application lost — passed, expired or withdrawn. */
  | 'lost'

export type LifecycleBranch =
  | 'draft'
  | 'refundExpired'
  | 'accept'
  | 'cancel'
  | 'submit'
  | 'approve'
  | 'claimAndProof'
  | 'addProof'
  | 'reclaim'
  | 'disputeOnly'
  | 'review'
  | 'disputedWithEvidence'
  | 'disputedNotice'

export function approvalBranch(
  gig: GigDetail,
  userId: string,
  now: Date = new Date(),
): ApprovalBranch | null {
  if (!gig.requires_approval) return null
  const ctx = approvalContextOf(gig)
  const application = gig.viewer?.application ?? null

  if (canAssign(ctx, userId, now)) return 'assign'
  if (canUnassign(ctx, userId, now)) return 'unassign'
  if (canReleaseAssignment(ctx, userId)) return 'release'
  if (canWithdrawApplication(application)) return 'withdraw'
  if (canApply(ctx, userId, application)) return 'apply'

  // A lost application, said plainly rather than shown as nothing — which
  // reads as "your application vanished".
  //
  // Deliberately excludes the WINNER: an `assigned` application belongs to
  // whoever is now doing the work, and they need Submit Proof / Add Proof from
  // the lifecycle branches, not a status line about a gig they are halfway
  // through.
  if (
    application !== null &&
    application.status !== 'open' &&
    application.status !== 'assigned' &&
    gig.counterparty?.id !== userId
  ) {
    return 'lost'
  }
  return null
}

export function lifecycleBranch(
  gig: GigDetail,
  userId: string,
  now: Date = new Date(),
): LifecycleBranch | null {
  const parties = partiesOf(gig)
  const isCreator = userId === gig.creator.id

  // Display-derived expiry: an open gig whose accept window passed (v2 has no
  // 'expired' status — the creator reclaims via refund_expired).
  const acceptExpired =
    gig.status === 'open' &&
    gig.accept_deadline !== null &&
    new Date(gig.accept_deadline).getTime() < now.getTime()

  if (gig.status === 'draft' && isCreator) return 'draft'

  if (gig.status === 'open') {
    if (acceptExpired && isCreator) return 'refundExpired'
    if (canAccept(parties, userId)) return 'accept'
    if (isCreator) return 'cancel'
  }

  if (canSubmit(parties, userId)) return 'submit'
  if (gig.status === 'submitted' && isCreator) return 'approve'

  // Disputed has its own branch below: the worker keeps adding evidence, but
  // must not see a redundant "Dispute" button.
  if (canAddProof(parties, userId) && gig.status !== 'disputed') {
    return canClaim({ ...parties, approval_deadline: gig.approval_deadline }, userId, now)
      ? 'claimAndProof'
      : 'addProof'
  }

  if (gig.status === 'accepted' && isCreator) {
    const completionPassed =
      gig.completion_deadline !== null &&
      new Date(gig.completion_deadline).getTime() < now.getTime()
    return completionPassed ? 'reclaim' : 'disputeOnly'
  }

  if (canReview(parties, userId) && !gig.reviews.some((r) => r.reviewer_id === userId)) {
    return 'review'
  }

  if (gig.status === 'disputed') {
    return canAddProof(parties, userId) ? 'disputedWithEvidence' : 'disputedNotice'
  }
  return null
}
