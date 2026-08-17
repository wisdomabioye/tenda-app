import {
  PROOF_TYPE_LABEL,
  chainLabel,
  formatDeadline,
  type GigDetail,
  type ProofType,
} from '@tenda/shared'
import type { DossierFact, DossierProof } from '@/components/escrow/dossier'

/**
 * The facts under the money block (Tier 2 comp, lines 520-540).
 *
 * Every one is read straight off the wire, and a fact with nothing behind it
 * is OMITTED rather than printed as an em dash — a labelled blank reads as a
 * value the reader failed to supply.
 */
export function dossierFactsFor(gig: GigDetail): readonly DossierFact[] {
  const facts: DossierFact[] = [{ label: 'Chain', value: chainLabel(gig.chain_id) }]
  if (gig.accept_deadline !== null) {
    facts.push({ label: 'Accept by', value: formatDeadline(gig.accept_deadline) })
  }
  if (gig.completion_deadline !== null) {
    facts.push({ label: 'Deliver by', value: formatDeadline(gig.completion_deadline) })
  }
  if (gig.approval_deadline !== null) {
    facts.push({ label: 'Auto-releases', value: formatDeadline(gig.approval_deadline) })
  }
  return facts
}

/**
 * Only what this mapper reads. `EscrowProof` is `InferSelectModel` of the
 * Drizzle row, so it carries every column and types `uploaded_at` as a **Date**
 * — which it is in the database and is NOT over the wire, where JSON has
 * already made it a string. Taking the narrow shape keeps that mismatch in one
 * place and lets a caller (or a test) hand over a proof without inventing
 * columns nobody renders.
 */
export interface DossierProofInput {
  id: string
  type: ProofType
  uploaded_at: Date | string | null
}

/**
 * The wire's proofs in the shape the dossier reads.
 *
 * The dossier asks for a LABEL, not a proof type, because it renders the same
 * list for a gig and an exchange and neither vocabulary belongs to it. The
 * label is the shared one, so a proof reads the same here as on the public
 * detail and in the upload dialog.
 */
export function dossierProofsFor(
  proofs: readonly DossierProofInput[] | null | undefined,
): readonly DossierProof[] | null {
  if (proofs === null || proofs === undefined) return null
  return proofs.map((proof) => ({
    id: proof.id,
    label: PROOF_TYPE_LABEL[proof.type],
    // Both forms, because the declared type and the runtime value disagree.
    uploadedAt: proof.uploaded_at instanceof Date
      ? proof.uploaded_at.toISOString()
      : proof.uploaded_at,
  }))
}
