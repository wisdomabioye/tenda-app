import {
  createQueryCache,
  type EscrowListRow,
  type ExchangeSummary,
  type GigSummary,
  type MyApplication,
  type MyDisputeRow,
  type NotificationWire,
  type QueryCache,
} from '@tenda/shared'

/**
 * Everything that must not outlive an account, and the one call that empties
 * it.
 *
 * Two kinds of thing live longer than the components that fill them:
 *
 *   - module-scoped list CACHES, because the workspace's list columns are
 *     remounted by the router on every row they open, so page zero has to
 *     outlive the component or the column blinks; and
 *   - zustand STORES, which are module singletons by construction.
 *
 * Module scope also outlives the SESSION. Signing out is a soft navigation —
 * `router.replace('/gigs')` keeps the JS context and every module in it — so
 * without this the next account in the same tab inherits the last one's state.
 * Measured before any of it existed: a second sign-in showed the first
 * account's dispute subjects, and (#25) the first account's gig detail,
 * counterparty and proofs included.
 *
 * REGISTER HERE, IN THE MODULE THAT OWNS THE STATE. The alternative — a list
 * of reset calls inside `logout` — is what this task exists to fix: three
 * stores were added over three tasks and none of them was ever added to that
 * list, because the place you must not forget was nowhere near the state you
 * were writing. `stores/__tests__/account-scope.guard.test.ts` fails on a new
 * store that is neither registered here nor listed as account-agnostic, so
 * forgetting is a red test rather than a leak.
 *
 * Account-AGNOSTIC state deliberately stays out: the chain registry and the
 * platform config are public server facts, identical for every reader, and
 * clearing them would refetch on the next sign-in for nothing — worse, it
 * would blank a rendered balance while the registry reloaded.
 */

/**
 * Only the capability the registry needs, so caches of different row types can
 * sit in one list without a cast to paper over the variance.
 */
interface Clearable {
  clear: () => void
}

const caches: Clearable[] = []
const resets: Array<() => void> = []

/**
 * Which account the state in memory belongs to. Bumped by every account
 * TRANSITION — sign-out, a cross-tab change, and sign-in — not only by clears.
 *
 * Emptying a store is a MOMENT; a request already on its way is not stopped by
 * it, and writes its result whenever it lands. So the previous account's rows
 * came back milliseconds after being dropped — the reset was real, and then it
 * was undone (#45; proved on the inbox, where the threads and their unread
 * badge returned).
 *
 * An async writer therefore takes a snapshot BEFORE its await and drops the
 * write if the number has moved. That states the actual rule — "this response
 * belongs to a previous account" — where a per-store request token can only
 * say "a later request superseded it", which a sign-out is not.
 */
let generation = 0

/** Snapshot before an await. Compare with `isSameAccount` after it. */
export function accountGeneration(): number {
  return generation
}

/** Whether the account is still the one `gen` was taken under. */
export function isSameAccount(gen: number): boolean {
  return gen === generation
}

/**
 * A new account now owns the in-memory state — WITHOUT emptying anything.
 *
 * For sign-IN, where there is nothing to clear (logout already did) but the
 * generation still has to move, so a request issued during the signed-out
 * window cannot write into the session that follows.
 *
 * It must not clear: `signin-flow` is MID-USE at that exact moment. Clearing
 * it empties `pending`, and /signin/verify renders nothing without it — the
 * reader watches their own sign-in card blank out one step before the next
 * page paints. That is the regression #14's review already fixed once, and
 * calling `clearAccountState` here brought it straight back (caught by
 * e2e/focused-shell, "the card stays on screen until the next step replaces
 * it" — no unit test saw it).
 */
export function beginAccountSession(): void {
  generation += 1
}

function register<TItem>(): QueryCache<TItem> {
  const cache = createQueryCache<TItem>()
  caches.push(cache)
  return cache
}

/**
 * Declare a store's state account-scoped. Call at module scope, next to the
 * state it protects — a store that is never imported holds nothing, so an
 * unregistered-because-unloaded store is not a leak.
 */
export function registerAccountReset(reset: () => void): void {
  resets.push(reset)
}

/** Page zero of "My Disputes", per bucket. */
export const disputesPageCache = register<MyDisputeRow>()

/**
 * My Gigs keeps FOUR lists so every tab's count is a real server total rather
 * than a zero for a list nobody fetched — which means four rebuilds per row
 * opened without these.
 */
export const postedGigsCache = register<GigSummary>()
export const workingGigsCache = register<GigSummary>()
export const draftGigsCache = register<GigSummary>()
export const myApplicationsCache = register<MyApplication>()

/** Page zero of the notification feed. */
export const notificationsCache = register<NotificationWire>()

/**
 * The exchange surface's two lists, per filter combination.
 *
 * This surface is not a list column, so it is not remounted per row — it is
 * UNMOUNTED, because opening an offer replaces the whole pane. Same outcome:
 * without these, coming back from an offer re-fetches the book the reader was
 * already reading and shows them a skeleton over it.
 *
 * `myTradesCache` is account-scoped and would otherwise show the previous
 * account its own trades after a same-tab switch; the order book is public to
 * anyone with the surface unlocked, and is registered because a cache outside
 * the registry is one nobody can empty.
 */
export const offerBookCache = register<ExchangeSummary>()
export const myTradesCache = register<EscrowListRow>()

/**
 * Empties every registered cache and store. Clears the SAME Map instances the
 * mounted hooks hold, so a column still on screen loses them too rather than
 * repainting from a cache the next reader was never meant to see.
 *
 * Called from EVERY account transition in a live tab, not just sign-out:
 * `logout`, the cross-tab `storage` listener (a sign-out or a different
 * sign-in elsewhere leaves this tab holding what a local one would have
 * cleared), and sign-IN itself — the signed-out window is not inert, so a
 * request issued during it must not land in the session that follows.
 */
export function clearAccountState(): void {
  // FIRST, so a response that lands during the clearing is already stale to
  // every guard that checks — the bump must not be observable as "after".
  beginAccountSession()
  for (const cache of caches) cache.clear()
  for (const reset of resets) reset()
}
