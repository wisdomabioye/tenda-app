import type { Gig } from '../types'
import { computeCompletionDeadline } from '../types/gig'

/**
 * Returns the most relevant deadline for a gig given its current status.
 * - open: accept_deadline (null if indefinitely open)
 * - accepted/submitted: completion deadline = accepted_at + completion_duration_seconds
 * - other: null
 */
export function computeRelevantDeadline(gig: Pick<Gig, 'status' | 'accept_deadline' | 'accepted_at' | 'completion_duration_seconds'>): Date | null {
  if (gig.status === 'open') {
    return gig.accept_deadline ? new Date(gig.accept_deadline) : null
  }
  if (gig.status === 'accepted' || gig.status === 'submitted') {
    if (!gig.accepted_at) return null
    return computeCompletionDeadline(new Date(gig.accepted_at), gig.completion_duration_seconds)
  }
  return null
}

export function canAccept(gig: Pick<Gig, 'status' | 'poster_id'>, userId: string): boolean {
  return gig.status === 'open' && userId !== gig.poster_id
}

export function canPublish(gig: Pick<Gig, 'status' | 'poster_id'>, userId: string): boolean {
  return gig.status === 'draft' && userId === gig.poster_id
}

export function canSubmit(gig: Pick<Gig, 'status' | 'worker_id'>, userId: string): boolean {
  return gig.status === 'accepted' && gig.worker_id === userId
}

export function canApprove(gig: Pick<Gig, 'status' | 'poster_id'>, userId: string): boolean {
  return gig.status === 'submitted' && userId === gig.poster_id
}

export function canDispute(gig: Pick<Gig, 'status' | 'poster_id' | 'worker_id'>, userId: string): boolean {
  const isParty = userId === gig.poster_id || userId === gig.worker_id
  return isParty && (gig.status === 'accepted' || gig.status === 'submitted')
}

export function canReview(gig: Pick<Gig, 'status' | 'poster_id' | 'worker_id'>, userId: string): boolean {
  const isParty = userId === gig.poster_id || userId === gig.worker_id
  return isParty && (gig.status === 'completed' || gig.status === 'resolved')
}

export function canCancel(gig: Pick<Gig, 'status' | 'poster_id'>, userId: string): boolean {
  return (gig.status === 'draft' || gig.status === 'open') && userId === gig.poster_id
}
