import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

interface Props {
  iso: string
}

function formatGroupTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long' })
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChatTimestampGroup({ iso }: Props) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      <Text style={[s.label, { color: theme.colors.content.tertiary }]}>
        {formatGroupTimestamp(iso)}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  label: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.55,
  },
})
