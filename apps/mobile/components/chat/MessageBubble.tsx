import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import type { LocalMessage } from '@/stores/chat.store'

interface MessageBubbleProps {
  message:  LocalMessage
  isMine:   boolean
  onRetry?: () => void
}

export function MessageBubble({ message, isMine, onRetry }: MessageBubbleProps) {
  const { theme } = useUnistyles()

  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  const isFailed  = message._status === 'failed'
  const isSending = message._status === 'sending'

  const statusText  = isFailed ? 'Failed — tap to retry' : isSending ? 'Sending…' : time
  const statusColor = isFailed
    ? (isMine ? theme.colors.onPrimary : theme.colors.warning)
    : isMine
      ? theme.colors.onPrimary
      : theme.colors.textFaint

  const bubbleStyle = [
    s.bubble,
    isMine
      ? [s.bubbleMine,   { backgroundColor: theme.colors.primary }]
      : [s.bubbleTheirs, { backgroundColor: theme.colors.surface }],
    isFailed && s.bubbleFailed,
  ]

  const content = (
    <>
      <Text
        style={s.content}
        color={isMine ? theme.colors.onPrimary : theme.colors.text}
      >
        {message.content}
      </Text>
      <Text size={10} color={statusColor} style={[s.time, isMine && !isFailed && s.timeMine]}>
        {statusText}
      </Text>
    </>
  )

  return (
    <View style={[s.row, isMine ? s.rowMine : s.rowTheirs]}>
      {isFailed && onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [bubbleStyle, pressed && s.bubblePressed]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={bubbleStyle}>
          {content}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row:          { flexDirection: 'row', marginBottom: spacing.xs, paddingHorizontal: spacing.md },
  rowMine:      { justifyContent: 'flex-end' },
  rowTheirs:    { justifyContent: 'flex-start' },
  bubble: {
    maxWidth:        '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius:    radius.lg,
  },
  bubbleMine:    { borderBottomRightRadius: 4 },
  bubbleTheirs:  { borderBottomLeftRadius: 4 },
  bubbleFailed:  { opacity: 0.7 },
  bubblePressed: { opacity: 0.5 },
  content: {
    fontFamily: typography.fonts.body.regular,
    fontSize:   typography.sizes.base,
    lineHeight: 20,
  },
  time: {
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeMine: {
    opacity: 0.65,
  },
})
