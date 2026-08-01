/**
 * Shapes the action-visibility helpers accept.
 *
 * Structural rather than nominal so one helper serves both wire projections
 * (ISO strings) and Drizzle rows, and both escrow kinds — gigs and P2P
 * exchanges are the same primitive with different vocabulary.
 */

import type { EscrowStatus } from '../../types/escrow'

export interface EscrowParties {
  creator_id: string
  counterparty_id: string | null
}

export type EscrowLike = EscrowParties & { status: EscrowStatus }

/**
 * How this escrow may be taken up. REQUIRED, not optional, and that is the
 * whole point: an optional mode field is how `canAccept` stayed mode-blind and
 * offered "Accept" on an escrow whose accept the chain would revert. Making it
 * required means every call site has to state which mode it is in, and a new
 * caller cannot forget.
 */
export interface EscrowAcceptanceMode {
  /** Approval mode: only the poster moves it forward, via `assign_accept`. */
  requires_approval: boolean
  /**
   * Whether SOMEONE is named as the assignee — spoken separately from WHO,
   * because the two have different audiences. "This gig is spoken for" is part
   * of the listing; the assignee's identity belongs to the parties, so the
   * detail route withholds the id from outsiders (see `escrow-detail-scope.ts`)
   * while keeping this flag accurate. Reading acceptability off the id alone
   * would make a withheld assignee look like an unassigned gig and offer a
   * stranger an Accept button the chain reverts.
   */
  is_assigned: boolean
  /**
   * Direct invite: only this user may accept. `null` when nobody is assigned —
   * OR when the reader is not entitled to know, hence `is_assigned` above.
   */
  assigned_counterparty_id: string | null
}

/**
 * The acceptance mode of an escrow that has none — P2P exchanges, which reject
 * `requires_approval` server-side and carry no assignee on the wire. Named so
 * the exchange call sites read as a deliberate statement rather than two
 * hardcoded literals nobody can explain later.
 */
// Readonly because it is a shared singleton every caller spreads: without it,
// one `UNRESTRICTED_ACCEPTANCE.requires_approval = true` anywhere would change
// the mode every exchange screen reports.
export const UNRESTRICTED_ACCEPTANCE: Readonly<EscrowAcceptanceMode> = {
  requires_approval: false,
  is_assigned: false,
  assigned_counterparty_id: null,
}

export function isParty(e: EscrowParties, userId: string): boolean {
  return userId === e.creator_id || userId === e.counterparty_id
}

/** Accepts both wire (ISO string) and row (Date) timestamps; null stays null. */
export function toDate(value: string | Date | null): Date | null {
  return value === null ? null : new Date(value)
}
