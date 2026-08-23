import {
  PROOF_TYPE_LABEL,
  chainLabel,
  formatDeadline,
  truncateWallet,
  type GigDetail,
  type ProofType,
} from '@tenda/shared'
import type { DossierFact, DossierProof } from '@/components/escrow/dossier'
import { GIG_DETAIL_COPY } from '@/components/gig/detail/copy'

/**
 * The facts under the money block (Tier 2 comp, lines 520-540).
 *
 * Every one is read straight off the wire, and a fact with nothing behind it
 * is OMITTED rather than printed as an em dash — a labelled blank reads as a
 * value the reader failed to supply.
 */
export function dossierFactsFor(gig: GigDetail): readonly DossierFact[] {
  const facts: DossierFact[] = [{ label: 'Chain', value: chainLabel(gig.chain_id) }]
  // Which of the viewer's wallets THIS escrow is bound to (viewer-relative on
  // the wire) — the workspace is where a worker looks first, and an assigned
  // worker never chose the wallet, the poster's assign baked their primary.
  if (gig.my_signer_address !== null) {
    facts.push({
      label: GIG_DETAIL_COPY.yourWallet,
      value: truncateWallet(gig.my_signer_address),
    })
  }
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
  url: string
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
    href: proof.url,
    // Both forms, because the declared type and the runtime value disagree.
    uploadedAt: proof.uploaded_at instanceof Date
      ? proof.uploaded_at.toISOString()
      : proof.uploaded_at,
  }))
}
