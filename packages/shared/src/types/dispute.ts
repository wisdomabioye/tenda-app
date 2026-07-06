/**
 * CO7 dispute-mediation thread types — shared by the server routes and the
 * mobile party UI (admin frontend later). One thread per dispute; both
 * parties and the claiming admin read/write the same messages.
 */
import type { InferSelectModel } from 'drizzle-orm'
import type { dispute_messages, dispute_resolutions } from '../db/schema'
import type { EscrowKind } from './escrow'
import type { UnsignedTx } from '../api/contracts/escrows.contract'

export type DisputeMessageRow = InferSelectModel<typeof dispute_messages>
export type DisputeResolutionRow = InferSelectModel<typeof dispute_resolutions>

/** On-chain outcome — same vocabulary as the winner enum and resolve flow. */
export type ResolutionWinner = 'creator' | 'counterparty' | 'split'
export type ResolutionStatus = 'pending' | 'executing' | 'confirmed' | 'rejected'

/** Wire shape of a resolution proposal (Date → ISO string). */
export interface DisputeResolution {
  id: string
  dispute_id: string
  proposed_winner: ResolutionWinner
  proposed_by: string
  status: ResolutionStatus
  threshold: number
  reject_reason: string | null
  rejected_by: string | null
  resolved_tx_ref: string | null
  created_at: string
  updated_at: string
}

/** A pending proposal in the signing queue, with escrow context for triage. */
export interface ResolutionQueueRow extends DisputeResolution {
  escrow_id: string
  kind: EscrowKind
  /** gig_details.title for gigs; null for exchanges. */
  subject_title: string | null
}

/** POST /v1/admin/disputes/:id/resolution */
export interface ProposeResolutionBody {
  winner: ResolutionWinner
}

/** POST /v1/admin/resolutions/:id/reject */
export interface RejectResolutionBody {
  reason: string
}

/**
 * POST /v1/admin/resolutions/:id/execute-build — the unsigned on-chain
 * resolve tx for the STORED proposed_winner, plus the fields the signer
 * needs to broadcast + client-ping without a second round-trip.
 */
export interface ResolutionExecuteBuild {
  resolution_id: string
  escrow_id: string
  chain_id: string
  proposed_winner: ResolutionWinner
  /**
   * The configured on-chain dispute authority for this chain (the wallet the
   * signer must connect); null when unconfigured, so the client skips the
   * pre-flight check rather than blocking.
   */
  dispute_admin_authority: string | null
  unsigned: UnsignedTx
}

/** Wire shape (Date → ISO string). */
export interface DisputeMessage {
  id: string
  dispute_id: string
  sender_id: string
  body: string
  created_at: string
}

/** Participant read cursor — lets clients render seen/unseen state. */
export interface DisputeReadCursor {
  user_id: string
  last_read_at: string
}

/** GET /v1/escrows/:id/dispute/messages */
export interface DisputeThreadResponse {
  dispute_id: string
  escrow_id: string
  /** Mediating admin (claim-based); null while unclaimed. */
  assigned_to_id: string | null
  /** Resolved disputes keep a readable, frozen thread. */
  read_only: boolean
  messages: DisputeMessage[]
  reads: DisputeReadCursor[]
}

/** POST /v1/escrows/:id/dispute/messages */
export interface SendDisputeMessageBody {
  body: string
}
