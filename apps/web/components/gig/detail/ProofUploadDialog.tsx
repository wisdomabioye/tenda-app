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
import { missingProofTypes, PROOF_TYPE_LABEL, type ProofType } from '@tenda/shared'
import { Button } from '@/components/ui/Button'
import { uploadProofs, type PersistableProof, type PickedProofFile } from '@/lib/uploads/escrow-proofs'
import { FilePicker } from '@/components/form/FilePicker'
import { Modal } from '@/components/ui/overlay/Modal'

export function ProofUploadDialog({
  open,
  onClose,
  title,
  submitLabel,
  closeMode,
  hint,
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

  async function handleSubmit() {
    if (files.length === 0) return
    setUploading(true)
    try {
      const proofs = await uploadProofs(files)
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

  // Mirrors the server gate exactly: it reads every proof row on the escrow,
  // so the checklist counts what is already stored plus what is picked now.
  const covered = [...alreadyAttached, ...files]
  const missing = missingProofTypes(requirements, covered)

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {requirements.length > 0 && (
        <p className="text-xs text-content-secondary">
          Required proof: {requirements.map((t) => PROOF_TYPE_LABEL[t]).join(', ')}.
          {missing.length > 0
            ? ` Still missing: ${missing.map((t) => PROOF_TYPE_LABEL[t].toLowerCase()).join(', ')}.`
            : ' All requirements covered.'}
        </p>
      )}
      <FilePicker files={files} onChange={setFiles} max={5} />
      {hint !== undefined && <p className="text-xs text-content-secondary">{hint}</p>}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={files.length === 0 || missing.length > 0 || uploading}
        onClick={handleSubmit}
      >
        {uploading ? 'Uploading…' : submitLabel}
      </Button>
    </Modal>
  )
}
