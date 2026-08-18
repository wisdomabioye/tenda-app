/**
 * The pure decisions behind `usePaginatedList`, kept out of the hook so they
 * can be stated once and tested directly.
 *
 * `hasMorePages` in particular was written TWICE inside the hook — once
 * negated as `loadMore`'s early-return guard, once positively as the returned
 * `hasMore` — in two different shapes. They agreed on every input, but nothing
 * made them agree, and the two read different totals (a ref in the guard, so a
 * call landing between a load settling and the re-render decides on fresh
 * data; state in the return, so render output matches what was rendered).
 * That difference is deliberate and survives here as the `total` argument.
 */
import { hasMore as deriveHasMore } from '@tenda/shared'

export interface HasMoreArgs {
  /** Cursor traversal, for a live list whose offsets shift under the reader. */
  cursorPagination: boolean
  /**
   * The server's cursor for the next page:
   *   • `undefined` — the server does not send one, so fall back to offsets
   *   • `null`      — the server says this is the end
   *   • a string    — there is another page
   */
  nextCursor: string | null | undefined
  offset: number
  total: number
}

export function hasMorePages({
  cursorPagination,
  nextCursor,
  offset,
  total,
}: HasMoreArgs): boolean {
  if (!cursorPagination || nextCursor === undefined) return deriveHasMore(offset, total)
  return nextCursor !== null
}

/** A thrown value as something a reader can be shown. */
export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong'
