/**
 * Renders one ordinary-lifecycle branch. Which branch is decided by the pure
 * `lifecycleBranch` in ./branches — this file only draws it.
 */
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { EscrowTxType } from '@tenda/shared'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import type { LifecycleBranch } from './branches'
import type { ActiveSheet } from './types'

interface Props {
  branch: LifecycleBranch
  isTxBuilding: boolean
  onAction: (action: ActiveSheet) => void
  onTxAction: (action: EscrowTxType) => void
  onRetryDraft: () => void
}

export function LifecycleCTA({
  branch,
  isTxBuilding,
  onAction,
  onTxAction,
  onRetryDraft,
}: Props) {
  const { theme } = useUnistyles()

  const disputedNotice = (
    <View style={[s.infoNotice, { backgroundColor: theme.colors.feedback.warning.surface }]}>
      <Text variant="caption" color={theme.colors.feedback.warning.base} weight="semibold" align="center">
        Under review by admin
      </Text>
    </View>
  )

  switch (branch) {
    // v2 drafts are pre-sign staging rows: signing happens in the create flow.
    // CO6 "retry from draft" prefills a fresh create instead of editing in
    // place (the unsigned tx is already bound to the old escrow id).
    case 'draft':
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

    case 'refundExpired':
      return (
        <Button variant="primary" size="xl" fullWidth loading={isTxBuilding} onPress={() => onTxAction('refund_expired')}>
          Claim Refund
        </Button>
      )

    case 'accept':
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onTxAction('accept')}>
          Accept Gig
        </Button>
      )

    case 'cancel':
      return (
        <Button variant="danger" size="xl" fullWidth onPress={() => onTxAction('cancel')}>
          Cancel Gig
        </Button>
      )

    case 'submit':
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onAction('proof')}>
          Submit Proof
        </Button>
      )

    // Approve is the happy path and owns a full-width row so its label never
    // wraps on narrow devices; Dispute stays prominent beneath it.
    case 'approve':
      return (
        <View style={s.ctaStack}>
          <Button variant="primary" size="xl" fullWidth loading={isTxBuilding} onPress={() => onTxAction('approve')}>
            Approve &amp; Pay
          </Button>
          <Button variant="danger" size="xl" fullWidth onPress={() => onAction('dispute')}>
            Dispute delivery
          </Button>
        </View>
      )

    case 'claimAndProof':
      return (
        <View style={s.ctaRow}>
          <Button variant="primary" size="xl" style={s.ctaFlex} loading={isTxBuilding} onPress={() => onTxAction('claim_stalled')}>
            Claim Payment
          </Button>
          <Button variant="outline" size="xl" onPress={() => onAction('addProof')}>
            Add Proof
          </Button>
        </View>
      )

    case 'addProof':
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

    case 'reclaim':
      return (
        <View style={s.ctaRow}>
          <Button variant="primary" size="xl" style={s.ctaFlex} loading={isTxBuilding} onPress={() => onTxAction('reclaim_abandoned')}>
            Reclaim Escrow
          </Button>
          <Button variant="danger" size="xl" onPress={() => onAction('dispute')}>
            Dispute
          </Button>
        </View>
      )

    case 'disputeOnly':
      return (
        <Button variant="danger" size="xl" fullWidth onPress={() => onAction('dispute')}>
          Dispute
        </Button>
      )

    case 'review':
      return (
        <Button variant="outline" size="xl" fullWidth onPress={() => onAction('review')}>
          Leave Review
        </Button>
      )

    case 'disputedWithEvidence':
      return (
        <View style={s.ctaStack}>
          <Button variant="outline" size="xl" fullWidth onPress={() => onAction('addProof')}>
            Add Evidence
          </Button>
          {disputedNotice}
        </View>
      )

    case 'disputedNotice':
      return disputedNotice
  }
}

const s = StyleSheet.create({
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  ctaStack: { gap: spacing.xs },
  ctaFlex: { flex: 1 },
  infoNotice: { padding: spacing.md, borderRadius: radius.md },
})
