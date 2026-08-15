import { GIG_CATEGORIES, type GigCategory, type GigListQuery } from '@tenda/shared'

/** The raw shape Next resolves from a page's `searchParams` promise. */
export type RawSearchParams = Record<string, string | string[] | undefined>

export const GIGS_PAGE_SIZE = 20

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** The filters the public feed exposes, all URL-addressable so views are linkable. */
export interface GigFeedFilters {
  category: GigCategory | null
  city: string | null
  chain_id: string | null
  remote: boolean
  q: string | null
  cursor: string | null
}

/**
 * Parse the page's search params into validated feed filters. Invalid values
 * are DROPPED, not forwarded: the server 400s an unknown chain_id or category
 * rather than returning an empty page, and a crawler following a mangled link
 * must get the unfiltered feed, not an error.
 *
 * `enabledChainIds` is the RUNNING deployment's registry (listEnabledChains) —
 * validating against the static manifest instead would forward provisioned-
 * looking ids the server still rejects.
 */
export function parseGigFeedFilters(
  params: RawSearchParams,
  enabledChainIds: ReadonlySet<string>,
): GigFeedFilters {
  const category = first(params.category)
  const chainId = first(params.chain_id)
  const city = first(params.city)?.trim()
  const q = first(params.q)?.trim()
  const cursor = first(params.cursor)?.trim()
  return {
    category: category !== undefined && (GIG_CATEGORIES as readonly string[]).includes(category)
      ? (category as GigCategory)
      : null,
    city: city !== undefined && city !== '' ? city : null,
    chain_id: chainId !== undefined && enabledChainIds.has(chainId) ? chainId : null,
    remote: first(params.remote) === 'true',
    q: q !== undefined && q !== '' ? q : null,
    cursor: cursor !== undefined && cursor !== '' ? cursor : null,
  }
}

/** The validated filters as the API's query shape. */
export function toGigListQuery(filters: GigFeedFilters): GigListQuery {
  return {
    category: filters.category ?? undefined,
    city: filters.city ?? undefined,
    chain_id: filters.chain_id ?? undefined,
    remote: filters.remote ? true : undefined,
    q: filters.q ?? undefined,
    cursor: filters.cursor ?? undefined,
    limit: GIGS_PAGE_SIZE,
  }
}

/**
 * Build a /gigs href with the given filter changes applied. `null` clears a
 * key. The cursor is intentionally dropped on every filter change — page
 * position in one filtering means nothing in another.
 */
export function gigsHref(
  filters: GigFeedFilters,
  changes: Partial<Record<'category' | 'city' | 'chain_id' | 'remote' | 'q' | 'cursor', string | null>> = {},
): string {
  const next = new URLSearchParams()
  const merged = {
    category: filters.category,
    city: filters.city,
    chain_id: filters.chain_id,
    remote: filters.remote ? 'true' : null,
    q: filters.q,
    // Dropped by default; the "more" link passes it back explicitly.
    cursor: null,
    ...changes,
  }
  for (const [key, value] of Object.entries(merged)) {
    if (value !== null && value !== undefined && value !== '') next.set(key, String(value))
  }
  const qs = next.toString()
  return qs === '' ? '/gigs' : `/gigs?${qs}`
}
