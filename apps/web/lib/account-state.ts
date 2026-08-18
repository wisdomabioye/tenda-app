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
 * Called from BOTH ways an account can change in a live tab: `logout`, and the
 * cross-tab `storage` listener — a sign-out in another tab leaves this one
 * holding the same state a local sign-out would have cleared.
 */
export function clearAccountState(): void {
  for (const cache of caches) cache.clear()
  for (const reset of resets) reset()
}
