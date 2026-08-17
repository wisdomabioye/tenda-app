import { chainLabel, gigPlaceLabel, type GigSummary } from '@tenda/shared'

/**
 * The row's second line: where the gig is, and which chain holds the money.
 *
 * The comp writes something richer here — `applicants` if any, else the
 * counterparty's name, else the place. **Neither of the first two is on the
 * wire.** `GigSummary` has no applicant count and no counterparty (only
 * `assigned_counterparty_id`, which is party-scoped and an ID, not a name), so
 * "4 applicants" beside a real gig would be a number this app invented — the
 * same call as spec-correction #13.
 *
 * What is left is true and useful, and it is what `MyGigCard` already showed:
 * the shared place label (never a bare country code, never "Anywhere" for a
 * gig nobody gave a location) and the chain.
 */
export function gigRowSubtitle(gig: GigSummary): string {
  return `${gigPlaceLabel(gig)} · ${chainLabel(gig.chain_id)}`
}
