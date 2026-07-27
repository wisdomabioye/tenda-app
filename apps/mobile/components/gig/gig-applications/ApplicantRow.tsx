/**
 * One applicant on the poster's shortlist: who they are, what they said, how
 * long their application stays assignable, and the Assign action.
 *
 * The countdown is not decoration. An application that lapses stops being
 * assignable — the server refuses it, and without the clock the poster would
 * pay gas to discover that — so the time left is the most decision-relevant
 * fact on the row.
 */
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { GigApplicant } from '@tenda/shared'
import { spacing, radius } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { ReviewScore } from '@/components/shared/ReviewScore'
import { DeadlineCountdown } from '@/components/shared/DeadlineCountdown'
import { applicantStatusLine } from './copy'

interface Props {
  applicant: GigApplicant
  /**
   * Whether the gig can still be assigned at all (open, in window, poster).
   * Passed in rather than derived here so one shared rule decides it for the
   * whole screen instead of each row re-deciding.
   */
  assignable: boolean
  /** True while ANY assignment is in flight — two rows must not both fire. */
  busy: boolean
  onAssign: (applicant: GigApplicant) => void
}

export function ApplicantRow({ applicant, assignable, busy, onAssign }: Props) {
  const { theme } = useUnistyles()
  const name = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const isOpen = applicant.status === 'open'

  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
      ]}
    >
      <View style={s.header}>
        <Avatar size="md" name={name} src={applicant.avatar_url} />
        <View style={s.identity}>
          <Text weight="semibold" numberOfLines={1}>
            {name}
          </Text>
          <ReviewScore score={applicant.review_score} />
        </View>
      </View>

      {applicant.message !== null && (
        <Text variant="caption" color={theme.colors.content.secondary} style={s.message}>
          {applicant.message}
        </Text>
      )}

      <View style={s.footer}>
        {isOpen ? (
          <DeadlineCountdown deadline={applicant.expires_at} label="Expires" />
        ) : (
          <Text variant="caption" color={theme.colors.content.tertiary}>
            {/* POSTER-voiced: this is their shortlist, not the applicant's list. */}
            {applicantStatusLine(applicant.status)}
          </Text>
        )}
        {assignable && isOpen && (
          <Button variant="primary" size="sm" loading={busy} onPress={() => onAssign(applicant)}>
            Assign
          </Button>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, gap: 2 },
  message: { lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
})
