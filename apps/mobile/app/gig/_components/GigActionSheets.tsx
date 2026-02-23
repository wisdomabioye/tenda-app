import { useState } from 'react'
import { View, Modal, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spacer } from '@/components/ui/Spacer'
import { Text } from '@/components/ui/Text'
import { showToast } from '@/components/ui/Toast'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { FilePicker, type PickedFile } from '@/components/form/FilePicker'
import { StarRating } from '@/components/form/StarRating'
import { useGigsStore } from '@/stores/gigs.store'
import { uploadToCloudinary } from '@/lib/upload'
import type { GigDetail, ReviewInput } from '@tenda/shared'
import type { ActiveSheet } from './GigCTABar'

type Score = 1 | 2 | 3 | 4 | 5

interface GigActionSheetsProps {
  gig: GigDetail
  activeSheet: ActiveSheet | null
  onClose: () => void
  onReviewSubmitted: () => void
  // Blockchain-backed actions: parent handles tx signing + monitoring
  onAcceptConfirmed: () => void
  onCancelOpenConfirmed: () => void
  onRefundExpiredConfirmed: () => void
  onProofsReady: (proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }>) => void
  onDisputeReady: (reason: string) => void
}

export function GigActionSheets({
  gig,
  activeSheet,
  onClose,
  onReviewSubmitted,
  onAcceptConfirmed,
  onCancelOpenConfirmed,
  onRefundExpiredConfirmed,
  onProofsReady,
  onDisputeReady,
}: GigActionSheetsProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { reviewGig, cancelDraftGig } = useGigsStore()

  const [proofFiles, setProofFiles] = useState<PickedFile[]>([])
  const [proofUploading, setProofUploading] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [reviewScore, setReviewScore] = useState<Score | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  // Reset form state when a sheet closes so stale input doesn't persist across opens.
  function handleClose() {
    setDisputeReason('')
    setReviewScore(null)
    setReviewComment('')
    onClose()
  }

  // Accept: close modal, hand off to parent for blockchain tx + monitoring
  function handleAccept() {
    handleClose()
    onAcceptConfirmed()
  }

  // Submit proof: upload files to Cloudinary, then hand off URLs to parent for blockchain tx
  async function handleSubmitProof() {
    if (proofFiles.length === 0) return
    setProofUploading(true)
    try {
      const proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }> = []
      for (const file of proofFiles) {
        try {
          const url = await uploadToCloudinary(file, 'proof')
          proofs.push({ url, type: file.type })
        } catch (e) {
          showToast('error', `Failed to upload "${file.name}": ${(e as Error).message}`)
          // Stop the loop — files already uploaded are discarded; user retries with all files.
          return
        }
      }
      handleClose()
      setProofFiles([])
      onProofsReady(proofs)
    } finally {
      setProofUploading(false)
    }
  }

  function handleDispute() {
    if (!disputeReason.trim()) return
    handleClose()
    onDisputeReady(disputeReason.trim())
  }

  async function handleReview() {
    if (!reviewScore) return
    try {
      await reviewGig(gig.id, { score: reviewScore as ReviewInput['score'], comment: reviewComment.trim() || undefined })
      handleClose()
      onReviewSubmitted()
      showToast('success', 'Review submitted!')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to submit review')
    }
  }

  async function handleCancelDraft() {
    handleClose()
    try {
      await cancelDraftGig(gig.id)
      showToast('success', 'Draft deleted')
      router.back()
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to delete draft')
    }
  }

  // Cancel open gig: close modal, hand off to parent for blockchain tx + monitoring
  function handleCancelOpen() {
    handleClose()
    onCancelOpenConfirmed()
  }

  // Refund expired: close modal, hand off to parent for blockchain tx + monitoring
  function handleRefundConfirm() {
    handleClose()
    onRefundExpiredConfirmed()
  }

  const isConfirm = activeSheet === 'accept' || activeSheet === 'cancel' || activeSheet === 'delete' || activeSheet === 'refund'

  return (
    <>
      <BottomSheet visible={activeSheet === 'proof'} onClose={handleClose} title="Submit proof">
        <FilePicker files={proofFiles} onChange={setProofFiles} accept="any" max={5} />
        <Spacer size={spacing.md} />
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={proofFiles.length === 0}
          loading={proofUploading}
          onPress={handleSubmitProof}
        >
          Submit
        </Button>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'dispute'} onClose={handleClose} title="Raise a dispute">
        <Input
          label="Reason"
          placeholder="Describe the issue clearly..."
          helper="An admin will review and reach out. Max 2000 characters."
          value={disputeReason}
          onChangeText={setDisputeReason}
          multiline
          numberOfLines={5}
          style={s.multiline}
          maxLength={2000}
        />
        <Spacer size={spacing.md} />
        <Button
          variant="danger"
          size="xl"
          fullWidth
          disabled={!disputeReason.trim()}
          onPress={handleDispute}
        >
          Raise Dispute
        </Button>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'review'} onClose={handleClose} title="Leave a review">
        <View style={s.starRow}>
          <StarRating value={reviewScore} onChange={(v) => setReviewScore(v as Score)} />
        </View>
        <Spacer size={spacing.md} />
        <Input
          label="Comment (optional)"
          placeholder="Share your experience..."
          helper="Optional — describe how the gig went"
          value={reviewComment}
          onChangeText={setReviewComment}
          multiline
          numberOfLines={3}
          style={s.multiline}
        />
        <Spacer size={spacing.md} />
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!reviewScore}
          onPress={handleReview}
        >
          Submit Review
        </Button>
      </BottomSheet>

      <Modal visible={isConfirm} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={[s.modalOverlay, { backgroundColor: theme.colors.scrim }]}>
          <View style={[s.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="subheading">
              {activeSheet === 'accept' ? 'Accept this gig?' :
               activeSheet === 'cancel' ? 'Cancel this gig?' :
               activeSheet === 'refund' ? 'Claim refund?' :
               'Delete this draft?'}
            </Text>
            <Spacer size={spacing.sm} />
            <Text variant="body" color={theme.colors.textSub}>
              {activeSheet === 'accept'
                ? 'You will be responsible for completing this gig within the deadline.'
                : activeSheet === 'cancel'
                ? 'The escrow will be refunded to your wallet on-chain.'
                : activeSheet === 'refund'
                ? 'The escrowed funds will be returned to your wallet. This cannot be undone.'
                : 'This action cannot be undone.'}
            </Text>
            <Spacer size={spacing.lg} />
            <View style={s.ctaRow}>
              <Button variant="ghost" size="md" style={s.ctaFlex} onPress={handleClose}>
                Cancel
              </Button>
              <Button
                variant={activeSheet === 'accept' ? 'primary' : 'danger'}
                size="md"
                style={s.ctaFlex}
                onPress={
                  activeSheet === 'accept' ? handleAccept :
                  activeSheet === 'cancel' ? handleCancelOpen :
                  activeSheet === 'refund' ? handleRefundConfirm :
                  handleCancelDraft
                }
              >
                Confirm
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  starRow: {
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctaFlex: {
    flex: 1,
  },
})
