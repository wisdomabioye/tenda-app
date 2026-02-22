import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { canPublish, canAccept, canSubmit, canReview } from '@tenda/shared'
import type { GigDetail } from '@tenda/shared'

export type ActiveSheet = 'proof' | 'dispute' | 'review' | 'accept' | 'cancel' | 'delete' | 'refund'

interface GigCTABarProps {
  gig: GigDetail
  userId: string
  reviewSubmitted: boolean
  txInProgress: boolean
  onAction: (action: ActiveSheet) => void
  onPublish: () => void
  onApprove: () => void
}

export function GigCTABar({
  gig,
  userId,
  reviewSubmitted,
  txInProgress,
  onAction,
  onPublish,
  onApprove,
}: GigCTABarProps) {
  const { theme } = useUnistyles()

  function renderContent() {
    if (txInProgress) {
      return (
        <View style={[s.infoNotice, { backgroundColor: theme.colors.warningTint }]}>
          <Text variant="caption" color={theme.colors.warning} weight="semibold" align="center">
            Transaction in progress — please wait…
          </Text>
        </View>
      )
    }

    if (canPublish(gig, userId)) {
      return (
        <View style={s.ctaRow}>
          <Button variant="primary" size="xl" style={s.ctaFlex} onPress={onPublish}>
            Publish Gig
          </Button>
          <Button
            variant="ghost"
            size="xl"
            onPress={() => onAction('delete')}
            style={{ borderColor: theme.colors.danger, borderWidth: 1 }}
          >
            Delete
          </Button>
        </View>
      )
    }

    if (gig.status === 'open') {
      if (canAccept(gig, userId)) {
        return (
          <Button variant="primary" size="xl" fullWidth onPress={() => onAction('accept')}>
            Accept Gig
          </Button>
        )
      }
      if (userId === gig.poster_id) {
        return (
          <Button variant="danger" size="xl" fullWidth onPress={() => onAction('cancel')}>
            Cancel Gig
          </Button>
        )
      }
    }

    if (canSubmit(gig, userId)) {
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onAction('proof')}>
          Submit Proof
        </Button>
      )
    }

    if (gig.status === 'submitted' && userId === gig.poster_id) {
      return (
        <View style={s.ctaRow}>
          <Button variant="primary" size="xl" style={s.ctaFlex} onPress={onApprove}>
            Approve & Pay
          </Button>
          <Button variant="danger" size="xl" onPress={() => onAction('dispute')}>
            Dispute
          </Button>
        </View>
      )
    }

    if (gig.status === 'accepted' && userId === gig.poster_id) {
      return (
        <Button variant="danger" size="xl" fullWidth onPress={() => onAction('dispute')}>
          Dispute
        </Button>
      )
    }

    if (gig.status === 'expired' && userId === gig.poster_id) {
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onAction('refund')}>
          Claim Refund
        </Button>
      )
    }

    if (canReview(gig, userId) && !reviewSubmitted) {
      return (
        <Button variant="outline" size="xl" fullWidth onPress={() => onAction('review')}>
          Leave Review
        </Button>
      )
    }

    if (gig.status === 'disputed') {
      return (
        <View style={[s.infoNotice, { backgroundColor: theme.colors.warningTint }]}>
          <Text variant="caption" color={theme.colors.warning} weight="semibold" align="center">
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
    <View style={[s.bottomBar, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.borderFaint }]}>
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
  ctaFlex: {
    flex: 1,
  },
  infoNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
})
