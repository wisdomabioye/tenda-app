import { useState } from 'react'
import { spacing } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { FilePicker, type PickedFile } from '@/components/form/FilePicker'
import { uploadProofs, type Proof } from './upload'

/**
 * Shared proof-upload sheet (submit-proof and add-more-proof). Owns its file
 * selection + upload state. `closeMode` preserves the two callers' timing:
 * - 'on-success': close + clear only if onSubmit resolves true (sheet stays
 *   open so the user can retry when the hand-off is rejected).
 * - 'before-submit': close + clear as soon as the upload succeeds, then fire
 *   onSubmit (the parent's tx UI takes over immediately).
 */
export function ProofUploadSheet({
  visible,
  onClose,
  title,
  submitLabel,
  closeMode,
  onSubmit,
}: {
  visible: boolean
  onClose: () => void
  title: string
  submitLabel: string
  closeMode: 'on-success' | 'before-submit'
  onSubmit: (proofs: Proof[]) => Promise<boolean>
}) {
  const [files, setFiles] = useState<PickedFile[]>([])
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

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <FilePicker files={files} onChange={setFiles} accept="any" max={5} />
      <Spacer size={spacing.md} />
      <Button variant="primary" size="xl" fullWidth disabled={files.length === 0} loading={uploading} onPress={handleSubmit}>
        {submitLabel}
      </Button>
    </BottomSheet>
  )
}
