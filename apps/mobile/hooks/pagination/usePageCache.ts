/**
 * The page-zero cache, as a hook of its own (#54). Mirrors web's
 * hooks/pagination/usePageCache (#46) with one deliberate difference: this
 * cache is INSTANCE-scoped — `useRef(createQueryCache())`, no caller-owned
 * `cache` option — because mobile has no equivalent of the workspace list
 * column that Next remounts on every row opened. It dies with the screen.
 *
 * That difference is also why there is no `rememberForAccount` here. Web needs
 * one because its cache outlives the session (#45); whether mobile's can, and
 * therefore whether it needs the same guard, is the open question in #55 — it
 * is deliberately NOT answered by this split, which preserves behaviour.
 */
import { useMemo, useRef } from 'react'
import { createQueryCache, readPage, rememberPage, type CachedPage } from '@tenda/shared'

export interface PageCache<TItem> {
  /** Remembered page zero for `key`, or undefined (also when caching is off). */
  read(key: string): CachedPage<TItem> | undefined
  /** Record page zero for `key`. */
  remember(key: string, page: CachedPage<TItem>): void
}

export function usePageCache<TItem>(cacheQueries: boolean): PageCache<TItem> {
  const cacheRef = useRef(createQueryCache<TItem>())

  // Identity changes ONLY when caching itself flips, so callbacks in the
  // paging hook can close over this without gaining a churning dependency.
  return useMemo<PageCache<TItem>>(
    () => ({
      read: (key) => (cacheQueries ? readPage(cacheRef.current, key) : undefined),
      remember: (key, page) => {
        if (cacheQueries) rememberPage(cacheRef.current, key, page)
      },
    }),
    [cacheQueries],
  )
}
