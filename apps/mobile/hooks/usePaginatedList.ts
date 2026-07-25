/**
 * Offset-pagination controller for every `PaginatedResponse` list surface
 * (gigs feed, my gigs, exchange order book, my trades, disputes).
 *
 * It exists because the same four mistakes were being made per-screen:
 *   1. deriving the next offset from `items.length`, which drifts the moment
 *      a duplicate is dropped and then silently SKIPS rows;
 *   2. appending without de-duplication, which produces duplicate React keys
 *      on a newest-first list that shifts under insertions;
 *   3. no generation guard, so a slow page-1 response lands after a filter
 *      change and shows rows that contradict the active filter;
 *   4. counts read off `items.length`, which post-pagination means "loaded
 *      so far", not the real total.
 *
 * The cursor-paginated notification feed keeps its own store — merging the
 * two shapes into one abstraction would buy nothing but indirection.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PaginatedResponse } from '@tenda/shared'
import { PAGE_SIZE, hasMore as deriveHasMore, mergeById, nextOffset } from '@/lib/pagination'

/** The page request the controller issues; the caller's query is spread in. */
export interface PageParams {
  limit: number
  offset: number
}

export interface UsePaginatedListOptions<TItem, TQuery extends object> {
  /**
   * Fetches one page. Receives the caller's query merged with limit/offset.
   * Must reject (not resolve empty) on failure so the error surfaces.
   */
  fetchPage: (params: TQuery & PageParams) => Promise<PaginatedResponse<TItem>>
  /**
   * Filter/scope params. A CHANGE resets the list to page 0 — identity is
   * compared by JSON shape, so callers may pass a fresh object literal each
   * render without memoising (the object is built by the same code path every
   * time, so key order is stable).
   */
  query: TQuery
  /** Stable identity for a row — the React key and the de-dupe key. */
  keyOf: (item: TItem) => string
  /** Rows per page (defaults to the shared PAGE_SIZE). */
  pageSize?: number
  /**
   * Gate the first load — e.g. until the user id is known. Flipping false→true
   * triggers the initial fetch; while false the list stays idle, NOT loading,
   * so a skeleton can't hang forever on a screen that will never fetch.
   */
  enabled?: boolean
}

export interface PaginatedListState<TItem> {
  items: TItem[]
  /** Server-authoritative row count for the ACTIVE query — use this for
   *  counts/badges, never `items.length`. */
  total: number
  hasMore: boolean
  /** First page in flight with nothing on screen yet (drives the skeleton). */
  isLoading: boolean
  isLoadingMore: boolean
  isRefreshing: boolean
  /** True once a load has settled, so an empty state isn't shown pre-fetch. */
  hasFetched: boolean
  error: string | null
  loadMore: () => void
  /** Pull-to-refresh: re-reads page 0 and DISCARDS later pages. */
  refresh: () => Promise<void>
  /**
   * Silent page-0 re-read that PRESERVES loaded pages (polling / focus).
   * RESOLVES WITH the fresh server total — a poller can't read it off `total`
   * or a ref instead, because those only update on the next render, one tick
   * after this promise settles. Returns the last known total if the read failed.
   */
  reload: () => Promise<number>
}

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong'

export function usePaginatedList<TItem, TQuery extends object>({
  fetchPage,
  query,
  keyOf,
  pageSize = PAGE_SIZE,
  enabled = true,
}: UsePaginatedListOptions<TItem, TQuery>): PaginatedListState<TItem> {
  const [items, setItems] = useState<TItem[]>([])
  const [total, setTotal] = useState(0)
  // Seeded from `enabled`, NOT false: the first fetch is kicked off by an
  // effect, which runs AFTER the first render. Starting at false renders one
  // frame of "loaded, no rows" — a flash of an empty list (or an empty state)
  // before the skeleton appears. A gated list stays false so a screen that
  // will never fetch can't hang on a skeleton.
  const [isLoading, setIsLoading] = useState(enabled)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Offset cursor, tracked explicitly rather than derived from items.length
  // (see lib/pagination/page.ts — de-dupe makes those diverge).
  const offsetRef = useRef(0)
  // Monotonic request generation: any response from an older generation is
  // dropped, which is what makes a filter change immune to a slow in-flight
  // page landing afterwards.
  const genRef = useRef(0)
  // Collapses concurrent loadMore calls — FlatList fires onEndReached more
  // than once per end-reach.
  const inFlightRef = useRef(false)

  // Latest values without re-creating callbacks (and thus re-triggering the
  // effect) on every render.
  const fetchPageRef = useRef(fetchPage)
  fetchPageRef.current = fetchPage
  const keyOfRef = useRef(keyOf)
  keyOfRef.current = keyOf
  const queryRef = useRef(query)
  queryRef.current = query

  const queryKey = JSON.stringify(query)

  // Mirrors `total` for synchronous reads inside async flows: state and refs
  // that shadow it only update on the next render, one tick too late for a
  // caller awaiting `reload()` (see its doc comment).
  const totalRef = useRef(0)

  /**
   * Load page 0. `mode` decides which spinner runs, what survives on success,
   * and what survives on failure:
   *   - 'initial' → skeleton; list replaced. The list IDENTITY changed (mount
   *                 or filter change), so on failure the old rows are cleared —
   *                 they belong to a query that is no longer active.
   *   - 'refresh' → pull-to-refresh spinner; list replaced on success. On
   *                 failure the loaded rows are KEPT: they are still valid,
   *                 just not newer, and blanking a scrolled list over a
   *                 transient blip is the worse failure.
   *   - 'reload'  → no spinner. Replaces while the user is still on page 0 (so
   *                 rows deleted server-side actually disappear) and merges
   *                 once later pages are loaded (so a poll can't collapse
   *                 them). Keeps rows on failure, like 'refresh'.
   * Resolves with the fresh server total in every mode.
   */
  const loadFirstPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'reload'): Promise<number> => {
      const gen = ++genRef.current
      inFlightRef.current = true
      if (mode === 'initial') setIsLoading(true)
      if (mode === 'refresh') setIsRefreshing(true)
      // Any in-flight loadMore is now superseded and will skip its own
      // cleanup (its generation is stale) — clear its spinner here so a
      // filter change mid-append can't strand the footer spinner on.
      setIsLoadingMore(false)
      setError(null)
      try {
        const page = await fetchPageRef.current({
          ...queryRef.current,
          limit: pageSize,
          offset: 0,
        })
        if (gen !== genRef.current) return totalRef.current // superseded
        setTotal(page.total)
        totalRef.current = page.total
        if (mode === 'reload' && offsetRef.current > pageSize) {
          // Past page 0: prepend-merge so the pages the user scrolled through
          // survive the poll. The cost is that rows deleted server-side linger
          // until an explicit refresh — accepted, because the alternative
          // (replacing) yanks the list out from under a scrolled user.
          // Consequence worth knowing: with rows deleted underneath a scrolled
          // user, `total` (server truth) can read LOWER than items.length
          // (which still holds the stale rows). Pull-to-refresh reconciles.
          // Not worth machinery to fix — closing the gap properly would mean
          // re-fetching every loaded page on every poll.
          setItems((current) => mergeById(page.data, current, keyOfRef.current))
          // Never rewind the cursor — later pages are still loaded, and a
          // rewind would re-walk them. Deliberately NOT advanced by the
          // number of newly-prepended rows either: under-advancing only costs
          // one redundant page (whose rows de-dupe away), whereas
          // over-advancing would skip rows the user never sees.
          offsetRef.current = Math.max(offsetRef.current, page.data.length)
        } else {
          // 'initial'/'refresh', and 'reload' while still on page 0 (the
          // common case — most users never scroll past it). Replacing is what
          // makes a gig that was taken or expired actually DISAPPEAR instead
          // of lingering; with no later pages loaded, nothing is lost.
          setItems(page.data)
          offsetRef.current = nextOffset(0, page.data.length)
        }
        return page.total
      } catch (e) {
        if (gen !== genRef.current) return totalRef.current
        setError(errorMessage(e))
        if (mode === 'initial') {
          // The list identity changed (mount, or a filter change), so whatever
          // is on screen belongs to a query that is no longer active — clear
          // it and let the screen show its error state. This is why 'initial'
          // clears even though the list is usually already empty: a filter
          // change re-enters here with the PREVIOUS filter's rows loaded.
          setItems([])
          setTotal(0)
          totalRef.current = 0
          offsetRef.current = 0
        }
        // 'refresh'/'reload' deliberately keep items, total and the cursor:
        // the rows are still valid, just not newer. `error` is set either way,
        // and PaginatedList only swaps in the error state when the list is
        // empty — so a failed refresh leaves the user's data intact.
        return totalRef.current
      } finally {
        if (gen === genRef.current) {
          inFlightRef.current = false
          setIsLoading(false)
          setIsRefreshing(false)
          setHasFetched(true)
        }
      }
    },
    [pageSize],
  )

  // Reset + reload whenever the query changes (or the gate opens). Bumping the
  // generation here is what invalidates any page still in flight for the OLD
  // query — without it a slow response repopulates the list with rows the
  // active filter excludes.
  useEffect(() => {
    if (!enabled) return
    // The cursor is NOT pre-rewound here. `loadFirstPage` always requests
    // offset 0 and owns the cursor on both outcomes, so rewinding up front is
    // redundant on success and actively wrong on failure — it would leave the
    // preserved rows paired with a cursor pointing back at page 0.
    void loadFirstPage('initial')
    // `queryKey` (not `query`) is the dep on purpose: it is the serialised
    // shape, so a caller passing a fresh object literal each render doesn't
    // refetch. loadFirstPage reads the live query through a ref.
  }, [queryKey, enabled, loadFirstPage])

  const loadMore = useCallback(() => {
    if (!enabled || inFlightRef.current) return
    // Gate on the REF, not the `total` state: state lags a render behind, so
    // a call landing between a load settling and the re-render would decide
    // using the previous total. Reading the ref also keeps this callback
    // stable, so FlatList's onEndReached prop stops changing every time the
    // total does.
    if (!deriveHasMore(offsetRef.current, totalRef.current)) return
    const gen = genRef.current
    inFlightRef.current = true
    setIsLoadingMore(true)
    void (async () => {
      try {
        const page = await fetchPageRef.current({
          ...queryRef.current,
          limit: pageSize,
          offset: offsetRef.current,
        })
        // A filter change (or refresh) mid-flight invalidates this page —
        // appending it would mix two different queries in one list.
        if (gen !== genRef.current) return
        setTotal(page.total)
        totalRef.current = page.total
        setItems((current) => mergeById(current, page.data, keyOfRef.current))
        offsetRef.current = nextOffset(offsetRef.current, page.data.length)
      } catch {
        // Non-fatal and deliberately not surfaced as a page-level error: the
        // list still holds valid rows. The next end-reach retries.
      } finally {
        if (gen === genRef.current) {
          inFlightRef.current = false
          setIsLoadingMore(false)
        }
      }
    })()
  }, [enabled, pageSize])

  const refresh = useCallback(async () => {
    // Same reason as the query effect: let loadFirstPage own the cursor, so a
    // failed refresh keeps items AND offset consistent with each other.
    await loadFirstPage('refresh')
  }, [loadFirstPage])

  const reload = useCallback(() => loadFirstPage('reload'), [loadFirstPage])

  return {
    items,
    total,
    hasMore: deriveHasMore(offsetRef.current, total),
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasFetched,
    error,
    loadMore,
    refresh,
    reload,
  }
}
