/**
 * Admin escrow dossier — the full mediation context behind a dispute:
 * both parties (structural creator/counterparty identity), amounts, the
 * kind-specific detail record, submitted proofs, and the on-chain
 * transaction timeline. Returned by GET /v1/admin/escrows/:id/dossier and
 * consumed by the dispute detail panel. Wire shape only (Date → ISO string).
 */
import type { EscrowKind, EscrowStatus } from './escrow'
import type { PartyRole } from '../utils/parties'

/** A party to the escrow. `role` is the structural, kind-agnostic identity. */
export interface DossierParty {
  role: PartyRole
  user_id: string
  first_name: string | null
  last_name: string | null
  /** True when this party raised the dispute. */
  raised_dispute: boolean
}

export type ProofType = 'image' | 'video' | 'document'

export interface DossierProof {
  id: string
  url: string
  type: ProofType
  uploaded_at: string
}

export interface DossierTransaction {
  id: string
  type: string
  tx_ref: string
  amount_raw: string | null
  platform_fee_raw: string | null
  /** Resolve rows only: the creator's principal share. */
  creator_payout_raw: string | null
  actor_id: string | null
  created_at: string
}

/** gig_details projection; deadlines live on the escrow, not here. */
export interface DossierGigDetails {
  title: string
  description: string | null
  /** Stored as free text (constrained to GIG_CATEGORIES at creation). */
  category: string
  country: string | null
  city: string | null
  remote: boolean
}

/** exchange_details projection; payment_proof_url is the fiat evidence. */
export interface DossierExchangeDetails {
  fiat_amount: string
  fiat_currency: string
  rate: string
  payment_window_seconds: number
  payment_proof_url: string | null
}

export interface AdminEscrowDossier {
  escrow_id: string
  kind: EscrowKind
  status: EscrowStatus
  chain_id: string
  asset: string
  amount_raw: string
  dispute_bond_raw: string
  created_at: string
  /** Ordered creator-first; counterparty omitted when never accepted. */
  parties: DossierParty[]
  /** Exactly one of gig/exchange is non-null, matching `kind`. */
  gig: DossierGigDetails | null
  exchange: DossierExchangeDetails | null
  proofs: DossierProof[]
  /** Oldest-first — renders as a status timeline. */
  transactions: DossierTransaction[]
}
