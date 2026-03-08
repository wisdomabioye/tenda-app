import { View, Pressable, StyleSheet } from 'react-native'
import { Briefcase } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

interface Props {
  gigId: string | null
  gigTitle: string | null
}

export function GigContextDivider({ gigId, gigTitle }: Props) {
  const { theme } = useUnistyles()
  const router = useRouter()

  const line = <View style={[s.line, { backgroundColor: theme.colors.borderFaint }]} />

  const label = gigId ? (
    <Pressable
      style={[s.badge, { backgroundColor: theme.colors.primaryTint }]}
      onPress={() => router.push(`/gig/${gigId}` as Parameters<typeof router.push>[0])}
    >
      <Briefcase size={11} color={theme.colors.primary} />
      <Text variant="caption" color={theme.colors.primary} numberOfLines={1} style={s.badgeText}>
        {gigTitle ?? 'View gig'}
      </Text>
    </Pressable>
  ) : (
    <Text variant="caption" color={theme.colors.textFaint} style={s.direct}>
      Direct message
    </Text>
  )

  return (
    <View style={s.row}>
      {line}
      {label}
      {line}
    </View>
  )
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  line:      { flex: 1, height: StyleSheet.hairlineWidth },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  badgeText: { maxWidth: 180 },
  direct:    { flexShrink: 0 },
})
