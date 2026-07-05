import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ShieldAlert } from 'lucide-react-native'
import { Text } from '@/components/ui/Text'
import { useMyStanding } from '@/hooks/useStanding'
import { spacing } from '@/theme/tokens'

function formatUntil(iso: string | null): string | null {
  if (iso === null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Persistent banner for the affected user's own active restriction
 * (stage-7 § UX placements). Renders nothing in good standing. The server
 * guard stays authoritative, this only explains it ahead of time.
 */
export function RestrictionBanner() {
  const { theme } = useUnistyles()
  const standing = useMyStanding()

  const restriction = standing?.restriction ?? null
  if (restriction === null) return null

  const until = formatUntil(restriction.until)
  const headline =
    restriction.kind === 'manual_review'
      ? 'Your account is under review.'
      : until !== null
        ? `Your account is restricted until ${until}.`
        : 'Your account is restricted.'

  return (
    <View
      style={[
        s.banner,
        {
          backgroundColor: theme.colors.feedback.warning.surface,
          borderColor: theme.colors.feedback.warning.base,
        },
      ]}
    >
      <ShieldAlert size={18} color={theme.colors.feedback.warning.base} />
      <View style={s.body}>
        <Text size={13} weight="semibold" color={theme.colors.feedback.warning.base}>
          {headline}
        </Text>
        <Text size={12} color={theme.colors.content.secondary} style={s.reason}>
          Reason: {restriction.reason}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  body: { flex: 1, gap: 2 },
  reason: { lineHeight: 16 },
})
