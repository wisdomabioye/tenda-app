/**
 * The gig detail's bottom action bar.
 *
 * Two families of branches live under gig-cta/: the ordinary lifecycle, and
 * the approval-mode surface (apply / assign / release). Approval is asked
 * FIRST because on an approval-mode gig it is the more specific answer; when
 * it has nothing to say — an instant-mode gig, or an approval-mode one past
 * the point where the mode matters — the lifecycle buttons take over.
 *
 * WHICH branch applies is decided by pure functions before anything renders,
 * so the bar knows whether it has content without calling a component as a
 * function (which would run that component's hooks in this one's slots).
 */
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { EscrowTxType, GigDetail } from '@tenda/shared'
import { spacing, radius } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import {
  ApprovalCTA,
  LifecycleCTA,
  approvalBranch,
  lifecycleBranch,
  type ActiveSheet,
  type ApprovalAction,
} from './gig-cta'

export type { ActiveSheet, ApprovalAction }

interface GigCTABarProps {
  gig: GigDetail
  userId: string
  /** True while an unsigned tx is being requested/signed. */
  isTxBuilding: boolean
  /** True while a broadcast tx awaits confirmation. */
  txInProgress: boolean
  onAction: (action: ActiveSheet) => void
  /** Wallet-opening transition → screen shows the shared confirm gate first. */
  onTxAction: (action: EscrowTxType) => void
  /** Approval-mode actions; the screen decides which of them reach a wallet. */
  onApprovalAction: (action: ApprovalAction) => void
  /** CO6 "retry from draft": prefill the create form from this draft. */
  onRetryDraft: () => void
}

export function GigCTABar({
  gig,
  userId,
  isTxBuilding,
  txInProgress,
  onAction,
  onTxAction,
  onApprovalAction,
  onRetryDraft,
}: GigCTABarProps) {
  const { theme } = useUnistyles()

  const approval = txInProgress ? null : approvalBranch(gig, userId)
  const lifecycle = txInProgress || approval !== null ? null : lifecycleBranch(gig, userId)
  if (!txInProgress && approval === null && lifecycle === null) return null

  return (
    <View
      style={[
        s.bottomBar,
        { backgroundColor: theme.colors.surface.background, borderTopColor: theme.colors.border.subtle },
      ]}
    >
      {txInProgress && (
        <View style={[s.infoNotice, { backgroundColor: theme.colors.feedback.warning.surface }]}>
          <Text variant="caption" color={theme.colors.feedback.warning.base} weight="semibold" align="center">
            Transaction in progress, please wait…
          </Text>
        </View>
      )}
      {approval !== null && (
        <ApprovalCTA
          branch={approval}
          gig={gig}
          busy={isTxBuilding}
          onAction={onApprovalAction}
        />
      )}
      {lifecycle !== null && (
        <LifecycleCTA
          branch={lifecycle}
          isTxBuilding={isTxBuilding}
          onAction={onAction}
          onTxAction={onTxAction}
          onRetryDraft={onRetryDraft}
        />
      )}
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
  infoNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
})
