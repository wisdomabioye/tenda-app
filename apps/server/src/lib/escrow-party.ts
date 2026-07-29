/**
 * Escrow party membership as SQL predicates.
 *
 * THREE of them, deliberately. `assigned_counterparty_id` is populated only in
 * the pre-accept direct-offer window, so "is a party to this escrow" means
 * different things depending on whether a pending assignment counts — and the
 * worker-side filters exclude the creator on top of that. These were eight
 * hand-written `or(...)` expressions across the server, split 4/2/2 between
 * the three meanings with nothing naming the distinction: swapping one for
 * another still compiles and still returns rows, it just quietly widens or
 * narrows who can see an escrow.
 *
 * Row-level party derivation (on an already-loaded escrow) lives in
 * `escrow-routes.ts` — `deriveCaller`, `canViewHidden`. This module is the
 * query-level counterpart; the two must agree on what a party is, which is
 * easier to check now that each side is one named thing.
 */

import { eq, or, type SQL } from 'drizzle-orm'
import { escrows } from '@tenda/shared/db/schema'

/**
 * Settled parties: the two columns that persist across the whole lifecycle.
 *
 * `or` is only `undefined` for an empty argument list, hence the cast — the
 * established pattern for composed Drizzle conditions in this codebase.
 */
export function isEscrowParty(userId: string): SQL {
  return or(eq(escrows.creator_id, userId), eq(escrows.counterparty_id, userId)) as SQL
}

/**
 * Settled parties PLUS a pending direct-offer assignee. Use wherever the user
 * must be able to see or act on an escrow they have not accepted yet;
 * `deriveCaller` maps that same column to the `assigned_counterparty` role.
 */
export function isEscrowPartyOrAssigned(userId: string): SQL {
  return or(isEscrowParty(userId), eq(escrows.assigned_counterparty_id, userId)) as SQL
}

/**
 * The WORKER side only — accepted counterparty or pending assignee, excluding
 * the creator. Backs the "gigs I'm working on" / `role=counterparty` filters,
 * where the point is to exclude escrows the caller posted themselves.
 */
export function isEscrowCounterpartySide(userId: string): SQL {
  return or(
    eq(escrows.counterparty_id, userId),
    eq(escrows.assigned_counterparty_id, userId),
  ) as SQL
}
