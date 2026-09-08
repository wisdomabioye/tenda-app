/**
 * Bound the feed's revision memory (#73).
 *
 * `GigFeedState.revisions` is the staleness guard: a frame for a gig whose
 * revision the client already holds is refused when older. Rows come and go —
 * a page turns, a gig closes, a filter changes — but their revisions were kept
 * FOREVER, on purpose: a late frame for a row the server has since dropped
 * must still be recognised as stale, or it replays as new. Every distinct gig
 * a session ever saw therefore stayed in the map, kilobytes per hour on a busy
 * feed and never released.
 *
 * The bound keeps every CURRENT row's revision — those are load-bearing — plus
 * the most recent `memory` others, in the order they were first remembered.
 * A late frame arrives within seconds of the row leaving; anything older than
 * hundreds of departures is not a late frame, it is a gig the reader will meet
 * afresh, and treating it as new is the right answer.
 */
import { MAX_PAGINATION_LIMIT } from '../utils/validation'

/**
 * How many departed rows' revisions to keep. Two server-capped pages: more
 * churn than a reader scrolls through between one frame and the next, and
 * about 12 KB at the largest page the server serves.
 */
export const GIG_FEED_REVISION_MEMORY = MAX_PAGINATION_LIMIT * 2

export function pruneGigFeedRevisions(
  revisions: Readonly<Record<string, string>>,
  currentIds: readonly string[],
  memory: number = GIG_FEED_REVISION_MEMORY,
): Readonly<Record<string, string>> {
  const current = new Set(currentIds)
  const entries = Object.entries(revisions)
  const departed = entries.filter(([id]) => !current.has(id))
  if (departed.length <= memory) return revisions
  // Object key order is insertion order for these (non-index) keys, so the
  // first entries are the longest remembered; drop from the front.
  const forget = new Set(departed.slice(0, departed.length - Math.max(0, memory)).map(([id]) => id))
  return Object.fromEntries(entries.filter(([id]) => !forget.has(id)))
}
