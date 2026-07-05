import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { canAccept, canSubmit, canAddProof, canReview, canClaim } from '@tenda/shared'
import type { GigDetail } from '@tenda/shared'

export type ActiveSheet =
  | 'proof'
  | 'addProof'
  | 'dispute'
  | 'review'
  | 'accept'
  | 'cancel'
  | 'delete'
  | 'refund'

interface GigCTABarProps {
  gig: GigDetail
  userId: string
  /** True while an unsigned tx is being requested/signed. */
  isTxBuilding: boolean
  /** True while a broadcast tx awaits confirmation. */
  txInProgress: boolean
  onAction: (action: ActiveSheet) => void
  onApprove: () => void
  onClaim: () => void
  /** CO6 "retry from draft": prefill the create form from this draft. */
  onRetryDraft: () => void
}

export function GigCTABar({
  gig,
  userId,
  isTxBuilding,
  txInProgress,
  onAction,
  onApprove,
  onClaim,
  onRetryDraft,
}: GigCTABarProps) {
  const { theme } = useUnistyles()

  // The shared visibility helpers take the party shape, derive it once.
  const parties = {
    status: gig.status,
    creator_id: gig.creator.id,
    counterparty_id: gig.counterparty?.id ?? null,
  }
  const isCreator = userId === gig.creator.id

  // Display-derived expiry: an open gig whose accept window passed (v2 has
  // no 'expired' status, the creator reclaims via refund_expired).
  const acceptExpired =
    gig.status === 'open' &&
    gig.accept_deadline !== null &&
    new Date(gig.accept_deadline).getTime() < Date.now()

  function renderContent() {
    if (txInProgress) {
      return (
        <View style={[s.infoNotice, { backgroundColor: theme.colors.feedback.warning.surface }]}>
          <Text variant="caption" color={theme.colors.feedback.warning.base} weight="semibold" align="center">
            Transaction in progress, please wait…
          </Text>
        </View>
      )
    }

    // v2 drafts are pre-sign staging rows: signing happens in the create
    // flow. CO6 "retry from draft", prefill a fresh create instead of
    // editing in place (the unsigned tx is already bound to this id).
    if (gig.status === 'draft' && isCreator) {
      return (
        <View style={s.ctaRow}>
          <View style={s.ctaFlex}>
            <Button variant="outline" size="xl" fullWidth onPress={() => onAction('delete')}>
              Delete Draft
            </Button>
          </View>
          <View style={s.ctaFlex}>
            <Button variant="primary" size="xl" fullWidth onPress={onRetryDraft}>
              Edit & repost
            </Button>
          </View>
        </View>
      )
    }

    if (gig.status === 'open') {
      if (acceptExpired && isCreator) {
        return (
          <Button variant="primary" size="xl" fullWidth loading={isTxBuilding} onPress={() => onAction('refund')}>
            Claim Refund
          </Button>
        )
      }
      if (canAccept(parties, userId)) {
        return (
          <Button variant="primary" size="xl" fullWidth onPress={() => onAction('accept')}>
            Accept Gig
          </Button>
        )
      }
      if (isCreator) {
        return (
          <Button variant="danger" size="xl" fullWidth onPress={() => onAction('cancel')}>
            Cancel Gig
          </Button>
        )
      }
    }

    if (canSubmit(parties, userId)) {
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onAction('proof')}>
          Submit Proof
        </Button>
      )
    }

    if (gig.status === 'submitted' && isCreator) {
      // Approve is the happy path and owns a full-width row so its label never
      // wraps on narrow devices; Dispute stays prominent as a full-width danger
      // row beneath it.
      return (
        <View style={s.ctaStack}>
          <Button variant="primary" size="xl" fullWidth loading={isTxBuilding} onPress={onApprove}>
            Approve & Pay
          </Button>
          <Button variant="danger" size="xl" fullWidth onPress={() => onAction('dispute')}>
            Dispute delivery
          </Button>
        </View>
      )
    }

    if (canAddProof(parties, userId)) {
      // Approval window passed with no dispute → the worker can claim.
      if (canClaim({ ...parties, approval_deadline: gig.approval_deadline }, userId)) {
        return (
          <View style={s.ctaRow}>
            <Button variant="primary" size="xl" style={s.ctaFlex} loading={isTxBuilding} onPress={onClaim}>
              Claim Payment
            </Button>
            <Button variant="outline" size="xl" onPress={() => onAction('addProof')}>
              Add Proof
            </Button>
          </View>
        )
      }
      return (
        <View style={s.ctaRow}>
          <Button variant="outline" size="xl" style={s.ctaFlex} onPress={() => onAction('addProof')}>
            Add More Proof
          </Button>
          <Button variant="danger" size="xl" onPress={() => onAction('dispute')}>
            Dispute
          </Button>
        </View>
      )
    }

    if (gig.status === 'accepted' && isCreator) {
      // Completion window + grace passed → the creator can reclaim the
      // abandoned escrow; until then dispute is the only creator action.
      const completionPassed =
        gig.completion_deadline !== null &&
        new Date(gig.completion_deadline).getTime() < Date.now()
      if (completionPassed) {
        return (
          <View style={s.ctaRow}>
            <Button variant="primary" size="xl" style={s.ctaFlex} loading={isTxBuilding} onPress={() => onAction('refund')}>
              Reclaim Escrow
            </Button>
            <Button variant="danger" size="xl" onPress={() => onAction('dispute')}>
              Dispute
            </Button>
          </View>
        )
      }
      return (
        <Button variant="danger" size="xl" fullWidth onPress={() => onAction('dispute')}>
          Dispute
        </Button>
      )
    }

    if (canReview(parties, userId) && !gig.reviews.some((r) => r.reviewer_id === userId)) {
      return (
        <Button variant="outline" size="xl" fullWidth onPress={() => onAction('review')}>
          Leave Review
        </Button>
      )
    }

    if (gig.status === 'disputed') {
      return (
        <View style={[s.infoNotice, { backgroundColor: theme.colors.feedback.warning.surface }]}>
          <Text variant="caption" color={theme.colors.feedback.warning.base} weight="semibold" align="center">
            Under review by admin
          </Text>
        </View>
      )
    }

    return null
  }

  const content = renderContent()
  if (!content) return null

  return (
    <View style={[s.bottomBar, { backgroundColor: theme.colors.surface.background, borderTopColor: theme.colors.border.subtle }]}>
      {content}
    </View>
  )
}

const s = StyleSheet.create({
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctaStack: {
    gap: spacing.xs,
  },
  ctaFlex: {
    flex: 1,
  },
  infoNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
})
