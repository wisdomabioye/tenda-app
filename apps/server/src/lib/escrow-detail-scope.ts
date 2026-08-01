/**
 * Who may see the PRIVATE half of an escrow detail, and the projection that
 * withholds it.
 *
 * `/v1/gigs/:id` is public (optionally authenticated) and `/v1/exchange/:id`
 * is readable by any signed-in user — both by design, a listing has to survive
 * a share link and a push deep-link. But "the listing is public" was silently
 * being read as "everything hanging off it is public too": the counterparty's
 * profile, the proof-of-work files, and the dispute reason all shipped to
 * anyone holding the id, at every status. Those describe the WORK RELATIONSHIP,
 * not the listing, so they are scoped to the parties.
 *
 * THREE rungs, and the difference between them is load-bearing:
 *
 *   isEscrowPartyRow            creator + accepted counterparty
 *   isEscrowPartyOrAssignedRow  + a pending direct-offer assignee
 *   canViewHiddenEscrow         + any admin role
 *
 * The first two live in `escrow-party.ts`, which owns the column set for every
 * sense of "party" in both SQL and row form. This module adds only the admin
 * rung and the projection, because only those are specific to the detail
 * routes.
 *
 * The admin rung is separated from the other two ON PURPOSE. It reads
 * `viewer.role`, and a role is only trustworthy on a route that ran the full
 * `authenticate` — that decorator re-reads the role from the DB precisely so a
 * demotion takes effect in 60s instead of waiting out a 7-day token. The
 * lenient `identifyViewer` path does a bare `jwtVerify`, so the role there is
 * whatever the JWT claimed when it was issued. Gating DISCLOSURE on that would
 * hand a demoted admin every escrow's private half for a week. Party
 * membership has no such problem: it is a fact about the escrow row, not about
 * the caller's current standing.
 *
 * So: disclosure is party-based (id only, no role), and the hidden-row gate —
 * which both routes reach only after a full `authenticate` — may consult the
 * role. Admins read escrows through the admin surfaces, which carry the same
 * evidence: GET /v1/admin/escrows/:id/dossier (proofs, parties, transactions,
 * exchange payment_proof_url) and GET /v1/admin/disputes (the reason), both
 * behind `requirePermission('escrows.read')`.
 */

import { ADMIN_ROLES } from '@tenda/shared'
import { isEscrowPartyOrAssignedRow, type EscrowPartyColumns } from '@server/lib/escrow-party'

/**
 * The reader, or `null` for an anonymous one. Only built on routes that ran
 * the full `authenticate`, because `role` is meaningless without it — see the
 * module header.
 */
export interface DetailViewer {
  id: string
  role: string
}

/**
 * Visibility of a taken-down listing (CO1: `escrows.hidden`). A hidden escrow
 * vanishes from public browse/detail but stays visible to its parties (funds
 * may be locked on-chain, they must still operate it) and to any admin role
 * (takedown review).
 *
 * The ONLY gate that reads a role, and both call sites reach it after
 * `fastify.authenticate` has re-read that role from the DB. It decides
 * visibility of the LISTING, not of the private half — an admin who opens a
 * taken-down gig sees what any reader sees, and reads the evidence in the
 * dossier.
 */
export function canViewHiddenEscrow(
  escrow: EscrowPartyColumns,
  viewer: DetailViewer | null,
): boolean {
  if (viewer === null) return false
  if (isEscrowPartyOrAssignedRow(escrow, viewer.id)) return true
  return ADMIN_ROLES.includes(viewer.role as (typeof ADMIN_ROLES)[number])
}

/**
 * The private half — the fields both detail routes withhold from a non-party.
 * Generic over the wire types so the one projection serves the gig and
 * exchange shapes without either importing the other's types.
 */
export interface EscrowPrivateFields<TUser, TProof, TDispute> {
  counterparty: TUser | null
  proofs: TProof[]
  dispute: TDispute | null
}

/**
 * Blank the private half for an outsider, pass it through untouched for a
 * party.
 *
 * Blanked rather than omitted: `counterparty: null`, `proofs: []` and
 * `dispute: null` are all states the wire type already has — an unaccepted
 * escrow, one with nothing submitted, one never disputed — so a client reads
 * "withheld" through the code path it already has for "not there yet". An
 * omitted key would instead be a second shape every consumer must learn.
 *
 * Returns a NEW object either way; the caller's input is never mutated.
 */
export function scopeEscrowPrivateFields<TUser, TProof, TDispute>(
  fields: EscrowPrivateFields<TUser, TProof, TDispute>,
  isParty: boolean,
): EscrowPrivateFields<TUser, TProof, TDispute> {
  if (isParty) return { ...fields }
  return { counterparty: null, proofs: [], dispute: null }
}
