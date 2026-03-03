import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import type { Conversation } from '@tenda/shared'

interface ConversationItemProps {
  conversation: Conversation
  onPress: () => void
}

export function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const { theme } = useUnistyles()

  const { other_user, last_message, last_message_at, unread_count } = conversation

  const displayName =
    [other_user.first_name, other_user.last_name].filter(Boolean).join(' ') || 'Anonymous'

  const time = last_message_at
    ? new Date(last_message_at).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    : ''

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent' },
      ]}
    >
      <Avatar size="md" name={displayName} src={other_user.avatar_url} />

      <View style={s.body}>
        <View style={s.nameRow}>
          <Text weight={unread_count > 0 ? 'semibold' : 'regular'} numberOfLines={1} style={s.name}>
            {displayName}
          </Text>
          <Text size={12} color={theme.colors.textFaint}>{time}</Text>
        </View>
        <View style={s.previewRow}>
          <Text
            variant="caption"
            color={unread_count > 0 ? theme.colors.text : theme.colors.textFaint}
            numberOfLines={1}
            style={s.preview}
          >
            {last_message ?? 'No messages yet'}
          </Text>
          {unread_count > 0 && (
            <View style={[s.badge, { backgroundColor: theme.colors.primary }]}>
              <Text size={11} color={theme.colors.onPrimary} weight="semibold">
                {unread_count > 9 ? '9+' : String(unread_count)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontFamily: typography.fonts.body.medium,
    fontSize: typography.sizes.base,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
})
