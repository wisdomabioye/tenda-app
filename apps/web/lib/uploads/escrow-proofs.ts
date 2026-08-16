/**
 * Proof persistence + upload glue — web ports of mobile's
 * features/escrow-proofs/persistEscrowProofs and gig-action-sheets/upload.
 */
import { ErrorCode, proofIdentity, type ProofType, ApiClientError } from '@tenda/shared'
import { api } from '@/api/client'
import { showToast } from '@/components/ui/Toast'
import { uploadToCloudinary } from '@/lib/uploads/upload'

export interface PersistableProof {
  url: string
  type: ProofType
}

/** Save uploaded proof identities, resolving a lost response by reading them back. */
export async function persistEscrowProofs(
  escrowId: string,
  proofs: PersistableProof[],
): Promise<void> {
  try {
    await api.escrows.addProofs({ id: escrowId }, { proofs })
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.code !== ErrorCode.REQUEST_TIMEOUT) throw error
    const persisted = await api.escrows.proofs({ id: escrowId })
    const persistedIds = new Set(persisted.map(proofIdentity))
    if (!proofs.every((proof) => persistedIds.has(proofIdentity(proof)))) throw error
  }
}

/** A picked browser file with the proof type the user assigned it. */
export interface PickedProofFile {
  file: File
  type: ProofType
}

/**
 * Upload picked proof files to Cloudinary in order. Returns the proof list on
 * success, or null if any file fails — the failing file is toasted and the
 * already-uploaded ones are discarded (the user retries with the full set).
 */
export async function uploadProofs(files: PickedProofFile[]): Promise<PersistableProof[] | null> {
  const proofs: PersistableProof[] = []
  for (const picked of files) {
    try {
      const url = await uploadToCloudinary(picked.file, 'proof')
      proofs.push({ url, type: picked.type })
    } catch (e) {
      showToast('error', `Failed to upload "${picked.file.name}": ${(e as Error).message}`)
      return null
    }
  }
  return proofs
}
