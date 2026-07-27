/**
 * Gig applications on the wire.
 *
 * Three shapes because three readers need different things:
 *  - `GigApplication` — the row itself, what the applicant gets back on apply.
 *  - `GigApplicant`   — the poster's shortlist: the row plus who sent it.
 *  - `MyApplication`  — the applicant's list: the row plus the gig it is on,
 *    because "did I win?" is only answerable with both.
 */

import type { ApplicationStatus } from '../constants/applications'
import type { GigSummary } from './gig'

export interface GigApplication {
  id: string
  escrow_id: string
  applicant_id: string
  /** Optional pitch, trimmed; null when the applicant sent none. */
  message: string | null
  status: ApplicationStatus
  /** ISO-8601. After this the application is no longer assignable. */
  expires_at: string
  created_at: string
}

/** One row of the poster's shortlist. */
export interface GigApplicant extends GigApplication {
  first_name: string
  last_name: string
  avatar_url: string | null
  /** users.review_score — numeric(3,2) as a string, or null when unrated. */
  review_score: string | null
}

/** One row of the applicant's own list. */
export interface MyApplication {
  application: GigApplication
  /**
   * The gig applied to. Nested rather than flattened so the summary stays
   * byte-identical to every other gig surface (lib/gig-read's stated purpose)
   * and the client can reuse the same card component.
   */
  gig: GigSummary
}

export interface ApplyToGigBody {
  /** Optional pitch; capped at APPLICATION_MESSAGE_MAX_LENGTH. */
  message?: string | null
}

/** Poster assigns a specific applicant; the tx is theirs to sign. */
export interface AssignWorkerBody {
  /** The applicant's user id — NOT their wallet; the adapter resolves that. */
  worker_user_id: string
}

/** Response to the assigned worker's off-chain "I'm not available". */
export interface ReleaseAssignmentResponse {
  /** ISO-8601 stamp recorded on the escrow. */
  released_at: string
}
