/**
 * Renders one approval-mode branch. Which branch is decided by the pure
 * `approvalBranch` in ./branches — this file only draws it.
 */
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { acceptWindowState, unassignWindowEndsAt, type GigDetail } from '@tenda/shared'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { DeadlineCountdown } from '@/components/shared/DeadlineCountdown'
import {
  applicantsCtaLabel,
  applicationStatusLine,
  openApplicationLine,
  UNASSIGN_WINDOW_WARNING,
} from '@/components/gig/gig-applications/copy'
import { approvalContextOf } from './parties'
import type { ApprovalBranch } from './branches'

/**
 * What this CTA can raise. `unassign` is the only one that ends in a wallet —
 * the screen routes it to the transaction gate — but it travels the same
 * channel so the bar has ONE callback and cannot wire a branch to the wrong one.
 */
export type ApprovalAction = 'apply' | 'withdraw' | 'release' | 'viewApplicants' | 'unassign'

interface Props {
  branch: ApprovalBranch
  gig: GigDetail
  busy: boolean
  onAction: (action: ApprovalAction) => void
}

export function ApprovalCTA({ branch, gig, busy, onAction }: Props) {
  const { theme } = useUnistyles()
  const application = gig.viewer?.application ?? null
  const acceptWindow = acceptWindowState(gig)

  switch (branch) {
    case 'assign':
      return (
        <Button variant="primary" size="xl" fullWidth onPress={() => onAction('viewApplicants')}>
          {applicantsCtaLabel(gig.viewer?.open_application_count ?? null)}
        </Button>
      )

    case 'unassign':
      return (
        <View style={s.stack}>
          {gig.assignment_released_at !== null && (
            <View style={[s.notice, { backgroundColor: theme.colors.feedback.warning.surface }]}>
              <Text variant="caption" color={theme.colors.feedback.warning.base} weight="semibold" align="center">
                Your worker said they are not available. Release the assignment to reopen the gig.
              </Text>
            </View>
          )}
          {/*
            Critical assessment #3: `accept_deadline` does NOT extend across
            assign/unassign cycles, so a poster cycling workers can run the
            clock out and lose the gig to the refund path. Warned on the time
            actually left rather than on how many times they have done it —
            the remaining window is what decides the outcome, and whether it is
            merely short or already gone decides which warning is true.
          */}
          {acceptWindow !== 'open' && (
            <View style={[s.notice, { backgroundColor: theme.colors.feedback.danger.surface }]}>
              <Text variant="caption" color={theme.colors.feedback.danger.base} align="center">
                {UNASSIGN_WINDOW_WARNING[acceptWindow]}
              </Text>
            </View>
          )}
          <Button variant="danger" size="xl" fullWidth loading={busy} onPress={() => onAction('unassign')}>
            Release assignment
          </Button>
          {/* The window is the only reason this button exists, so it is shown
              rather than left to be discovered when the button disappears. */}
          <DeadlineCountdown
            deadline={unassignWindowEndsAt(approvalContextOf(gig))}
            label="Release window"
          />
        </View>
      )

    case 'release':
      return (
        <Button variant="outline" size="xl" fullWidth loading={busy} onPress={() => onAction('release')}>
          I&apos;m not available
        </Button>
      )

    case 'withdraw':
      return (
        <View style={s.stack}>
          <View style={[s.notice, { backgroundColor: theme.colors.surface.inset }]}>
            <Text variant="caption" color={theme.colors.content.secondary} align="center">
              {openApplicationLine(gig)}
            </Text>
            <DeadlineCountdown deadline={application?.expires_at ?? null} label="Expires" />
          </View>
          <Button variant="outline" size="xl" fullWidth loading={busy} onPress={() => onAction('withdraw')}>
            Withdraw application
          </Button>
        </View>
      )

    case 'apply':
      return (
        <View style={s.stack}>
          {application !== null && (
            <Text variant="caption" color={theme.colors.content.tertiary} align="center">
              {applicationStatusLine(application.status, null)}
            </Text>
          )}
          <Button variant="primary" size="xl" fullWidth loading={busy} onPress={() => onAction('apply')}>
            Apply for this gig
          </Button>
        </View>
      )

    case 'lost':
      return (
        <View style={[s.notice, { backgroundColor: theme.colors.surface.inset }]}>
          <Text variant="caption" color={theme.colors.content.secondary} align="center">
            {applicationStatusLine(application?.status ?? '', null)}
          </Text>
        </View>
      )
  }
}

const s = StyleSheet.create({
  stack: { gap: spacing.xs },
  notice: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
})
