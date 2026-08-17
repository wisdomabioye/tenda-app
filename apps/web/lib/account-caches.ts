import {
  createQueryCache,
  type GigSummary,
  type MyApplication,
  type MyDisputeRow,
  type NotificationWire,
  type QueryCache,
} from '@tenda/shared'

/**
 * Module-scoped list caches, and the one place that empties them.
 *
 * The workspace's list columns are REMOUNTED by the router on every row they
 * open (the @list slot moves between its entries), so page zero has to outlive
 * the component or the column blinks. Module scope is what gives it that life —
 * and module scope also outlives the SESSION, because signing out is a soft
 * navigation: `router.replace('/gigs')` keeps the JS context, and with it every
 * module in it.
 *
 * Measured before this existed: signing in as a second account in the same tab
 * showed the first account's dispute subjects in the column. So a cache that
 * survives a remount must be registered here, and `logout` empties the lot —
 * the same doctrine `logout` already applies to the notifications store.
 *
 * Register a cache HERE rather than declaring one beside its hook. A cache
 * nobody can clear is a leak with a comment on it.
 */
/**
 * Only the capability the registry needs, so caches of different row types can
 * sit in one list without a cast to paper over the variance.
 */
interface Clearable {
  clear: () => void
}

const registry: Clearable[] = []

function register<TItem>(): QueryCache<TItem> {
  const cache = createQueryCache<TItem>()
  registry.push(cache)
  return cache
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
 * Empties every registered cache. Clears the SAME Map instances the mounted
 * hooks hold, so a column still on screen loses them too rather than repainting
 * from a cache the next reader was never meant to see.
 */
export function clearAccountCaches(): void {
  for (const cache of registry) cache.clear()
}
