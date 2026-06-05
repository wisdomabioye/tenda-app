import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { useIsDark } from '@/lib/theme'
import { formatConvoTime } from '@/lib/date'
import type { DisputeMessage } from '@tenda/shared'

export type DisputeSenderKind = 'me' | 'party' | 'mediator'

interface Props {
  message: DisputeMessage
  sender: DisputeSenderKind
}

// Same calmed blues as chat's MessageBubble; the mediator gets a neutral
// card so the three voices in the shared thread are visually distinct.
const ME_BG_LIGHT = '#4365D2'
const ME_BG_DARK = '#3F5BA8'

const SENDER_LABEL: Record<Exclude<DisputeSenderKind, 'me'>, string> = {
  party: 'Other party',
  mediator: 'Mediator',
}

export function DisputeMessageBubble({ message, sender }: Props) {
  const { theme } = useUnistyles()
  const isDark = useIsDark()

  const isMine = sender === 'me'
  const themBg = isDark ? '#1B2231' : theme.colors.surface.inset
  const bubbleBg = isMine ? (isDark ? ME_BG_DARK : ME_BG_LIGHT) : themBg
  const textColor = isMine ? '#FFFFFF' : theme.colors.content.primary

  return (
    <View style={[s.row, isMine ? s.rowMine : s.rowTheirs]}>
      <View style={[s.bubble, { backgroundColor: bubbleBg }]}>
        {!isMine && (
          <Text
            variant="caption"
            weight="semibold"
            color={sender === 'mediator' ? theme.colors.brand.primary : theme.colors.content.tertiary}
          >
            {SENDER_LABEL[sender]}
          </Text>
        )}
        <Text color={textColor}>{message.body}</Text>
        <Text
          variant="caption"
          color={isMine ? 'rgba(255,255,255,0.7)' : theme.colors.content.tertiary}
          style={s.time}
        >
          {formatConvoTime(message.created_at)}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: 16,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 2,
  },
  time: { alignSelf: 'flex-end' },
})
