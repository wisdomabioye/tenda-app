'use client'

/**
 * Shared proof-upload dialog (submit-proof and add-more-proof) — web port of
 * mobile's ProofUploadSheet. Owns its file selection + upload state.
 * `closeMode` preserves the two callers' timing:
 * - 'on-success': close + clear only if onSubmit resolves true.
 * - 'before-submit': close + clear as soon as the upload succeeds, then fire
 *   onSubmit (the parent's tx UI takes over immediately).
 *
 * `requirements` mirrors the server's submit gate as a live checklist —
 * advisory UI only, the server re-checks.
 */
import { useState } from 'react'
import { missingProofTypes, type ProofType } from '@tenda/shared'
import { Button } from '@/components/ui/Button'
import { uploadProofs, type PersistableProof, type PickedProofFile } from '@/lib/uploads/escrow-proofs'
import { FilePicker } from '@/components/form/FilePicker'
import { Modal } from '@/components/ui/overlay/Modal'
import { SigningWalletRow } from '@/components/wallet/SigningWalletRow'
import { PROOF_DIALOG_COPY } from './copy'

export function ProofUploadDialog({
  open,
  onClose,
  title,
  submitLabel,
  closeMode,
  hint,
  chainId,
  boundSigner,
  requirements = [],
  alreadyAttached = [],
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  submitLabel: string
  closeMode: 'on-success' | 'before-submit'
  /** Optional note above the button, e.g. that submitting opens the wallet. */
  hint?: string
  /**
   * The escrow's chain — pass it ONLY when submitting commits on-chain
   * (submit-proof). With it the dialog previews the signing wallet, the same
   * row every other wallet-opening gate shows; the off-chain add-more-proof
   * path omits it and no wallet is promised.
   */
  chainId?: string
  /** The chain-bound signer for this viewer (`my_signer_address`), when recorded. */
  boundSigner?: string | null
  /** Proof types the poster requires; empty for the add-more-evidence path. */
  requirements?: readonly ProofType[]
  /**
   * Proofs already stored against the escrow. The server counts these, so
   * the dialog must too — otherwise a worker whose upload succeeded but
   * whose submit tx failed is locked out on retry.
   */
  alreadyAttached?: readonly { type: ProofType }[]
  onSubmit: (proofs: PersistableProof[]) => Promise<boolean>
}) {
  const [files, setFiles] = useState<PickedProofFile[]>([])
  const [uploading, setUploading] = useState(false)

  // Mirrors the server gate exactly: it reads every proof row on the escrow,
  // so the checklist counts what is already stored plus what is picked now.
  const covered = [...alreadyAttached, ...files]
  const missing = missingProofTypes(requirements, covered)

  /**
   * Submitting with NOTHING newly picked, because the escrow already holds the
   * evidence. The case is a worker whose files uploaded and whose submit
   * transaction then failed — a declined wallet, a dropped connection. The
   * upload is the leg that SUCCEEDED, and demanding it again was asking them
   * to re-do the expensive half of a two-part action to retry the cheap half.
   *
   * Only the submit path can reach this: "Add more proof" is handed no
   * `alreadyAttached`, and uploading nothing there would mean nothing at all.
   */
  const reusesAttached = files.length === 0 && alreadyAttached.length > 0
  const canSubmit = !uploading && missing.length === 0 && (files.length > 0 || reusesAttached)

  async function handleSubmit() {
    if (!canSubmit) return
    setUploading(true)
    try {
      // Nothing new picked is the RETRY path (see `reusesAttached`): there is
      // nothing to upload, only a transaction to sign again.
      const proofs = files.length === 0 ? [] : await uploadProofs(files)
      if (proofs === null) return // failure already toasted
      if (closeMode === 'before-submit') {
        onClose()
        setFiles([])
        await onSubmit(proofs)
      } else if (await onSubmit(proofs)) {
        onClose()
        setFiles([])
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {requirements.length > 0 && (
        <p className="text-xs text-content-secondary">
          {PROOF_DIALOG_COPY.required(requirements)}
          {missing.length > 0
            ? PROOF_DIALOG_COPY.stillNeeded(missing)
            : PROOF_DIALOG_COPY.allCovered}
        </p>
      )}
      {alreadyAttached.length > 0 && (
        <p className="text-xs text-content-secondary">
          {PROOF_DIALOG_COPY.alreadyAttached(alreadyAttached.map((proof) => proof.type))}
        </p>
      )}
      <FilePicker files={files} onChange={setFiles} max={5} />
      {chainId !== undefined && (
        <SigningWalletRow
          chainId={chainId}
          {...(boundSigner !== undefined ? { bound: boundSigner } : {})}
        />
      )}
      {hint !== undefined && <p className="text-xs text-content-secondary">{hint}</p>}
      <Button variant="primary" size="lg" fullWidth disabled={!canSubmit} onClick={handleSubmit}>
        {uploading ? PROOF_DIALOG_COPY.working(reusesAttached) : submitLabel}
      </Button>
    </Modal>
  )
}
