/**
 * CO7 dispute-mediation thread types — shared by the server routes and the
 * mobile party UI (admin frontend later). One thread per dispute; both
 * parties and the claiming admin read/write the same messages.
 */
import type { InferSelectModel } from 'drizzle-orm'
import type { dispute_messages } from '../db/schema'

export type DisputeMessageRow = InferSelectModel<typeof dispute_messages>

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
