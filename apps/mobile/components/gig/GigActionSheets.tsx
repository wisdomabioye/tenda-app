import { useRouter } from 'expo-router'
import { showToast } from '@/components/ui/Toast'
import { api } from '@/api/client'
import type { GigDetail } from '@tenda/shared'
import type { ActiveSheet } from './GigCTABar'
import { ProofUploadSheet } from './gig-action-sheets/ProofUploadSheet'
import { DisputeSheet } from './gig-action-sheets/DisputeSheet'
import { ReviewSheet } from './gig-action-sheets/ReviewSheet'
import { ConfirmModal, type ConfirmKind } from './gig-action-sheets/ConfirmModal'
import type { Proof } from './gig-action-sheets/upload'

interface GigActionSheetsProps {
  /** Only the escrow id is consumed, gig and exchange details both fit. */
  gig: Pick<GigDetail, 'escrow_id'>
  activeSheet: ActiveSheet | null
  onClose: () => void
  onReviewSubmitted: () => void
  // Blockchain-backed actions: parent handles tx signing + monitoring
  onAcceptConfirmed: () => void
  onCancelOpenConfirmed: () => void
  onRefundExpiredConfirmed: () => void
  onProofsReady: (proofs: Proof[]) => Promise<boolean>
  onAddProofsReady: (proofs: Proof[]) => Promise<void>
  onDisputeReady: (reason: string) => Promise<boolean>
}

const CONFIRM_KINDS: ConfirmKind[] = ['accept', 'cancel', 'delete', 'refund']

export function GigActionSheets({
  gig,
  activeSheet,
  onClose,
  onReviewSubmitted,
  onAcceptConfirmed,
  onCancelOpenConfirmed,
  onRefundExpiredConfirmed,
  onProofsReady,
  onAddProofsReady,
  onDisputeReady,
}: GigActionSheetsProps) {
  const router = useRouter()

  async function handleCancelDraft() {
    onClose()
    try {
      // Drafts are pre-sign staging rows, discarded off-chain.
      await api.escrows.delete({ id: gig.escrow_id })
      showToast('success', 'Draft deleted')
      router.back()
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to delete draft')
    }
  }

  // Map a confirm dialog kind to its action. On-chain actions close then hand
  // off to the parent (tx signing + monitoring); delete is handled locally.
  const confirmKind = CONFIRM_KINDS.includes(activeSheet as ConfirmKind) ? (activeSheet as ConfirmKind) : null
  function handleConfirm() {
    if (confirmKind === 'delete') {
      void handleCancelDraft()
      return
    }
    onClose()
    if (confirmKind === 'accept') onAcceptConfirmed()
    else if (confirmKind === 'cancel') onCancelOpenConfirmed()
    else if (confirmKind === 'refund') onRefundExpiredConfirmed()
  }

  return (
    <>
      <ProofUploadSheet
        visible={activeSheet === 'proof'}
        onClose={onClose}
        title="Submit proof"
        submitLabel="Submit"
        closeMode="on-success"
        onSubmit={onProofsReady}
      />

      <ProofUploadSheet
        visible={activeSheet === 'addProof'}
        onClose={onClose}
        title="Add more proof"
        submitLabel="Upload"
        closeMode="before-submit"
        onSubmit={async (proofs) => {
          await onAddProofsReady(proofs)
          return true
        }}
      />

      <DisputeSheet visible={activeSheet === 'dispute'} onClose={onClose} onDisputeReady={onDisputeReady} />

      <ReviewSheet
        visible={activeSheet === 'review'}
        onClose={onClose}
        escrowId={gig.escrow_id}
        onReviewSubmitted={onReviewSubmitted}
      />

      <ConfirmModal kind={confirmKind} onCancel={onClose} onConfirm={handleConfirm} />
    </>
  )
}
