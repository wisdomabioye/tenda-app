import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { AttachmentPreview } from '@/components/shared/media/AttachmentPreview'
import { useIsDark } from '@/lib/theme'
import { formatConvoTime } from '@/lib/date'
import type { AttachmentPress } from '@/lib/attachments'
import type { DisputeMessage } from '@tenda/shared'

export type DisputeSenderKind = 'me' | 'party' | 'mediator'

interface Props {
  message: DisputeMessage
  sender: DisputeSenderKind
  /** Actual name of the other party (falls back to a generic label). */
  senderName?: string
  /** Render the sender label — true only at the start of a same-sender run. */
  showSender?: boolean
  /** Render the timestamp — true only at the end of a same-sender run. */
  showTime?: boolean
  onAttachmentPress?: (attachment: AttachmentPress) => void
}

// Same calmed blues as chat's MessageBubble; the mediator gets a neutral
// card so the three voices in the shared thread are visually distinct.
const ME_BG_LIGHT = '#4365D2'
const ME_BG_DARK = '#3F5BA8'

export function DisputeMessageBubble({
  message,
  sender,
  senderName,
  showSender = true,
  showTime = true,
  onAttachmentPress,
}: Props) {
  const { theme } = useUnistyles()
  const isDark = useIsDark()

  const isMine = sender === 'me'
  const themBg = isDark ? '#1B2231' : theme.colors.surface.inset
  const bubbleBg = isMine ? (isDark ? ME_BG_DARK : ME_BG_LIGHT) : themBg
  const textColor = isMine ? '#FFFFFF' : theme.colors.content.primary
  const label = sender === 'mediator' ? 'Mediator' : (senderName ?? 'Other party')
  const attachmentUrl = message.attachment_url
  const attachmentType = message.attachment_type

  return (
    <View
      style={[
        s.row,
        isMine ? s.rowMine : s.rowTheirs,
        // Tighten the gap between grouped (continuation) bubbles.
        showSender ? s.rowLead : s.rowCont,
      ]}
    >
      <View style={[s.bubble, { backgroundColor: bubbleBg }]}>
        {!isMine && showSender && (
          <Text
            variant="caption"
            weight="semibold"
            color={sender === 'mediator' ? theme.colors.brand.primary : theme.colors.content.tertiary}
          >
            {label}
          </Text>
        )}
        {attachmentUrl !== null && attachmentType !== null && (
          <AttachmentPreview
            url={attachmentUrl}
            type={attachmentType}
            textColor={textColor}
            onPress={() =>
              onAttachmentPress?.({ id: message.id, url: attachmentUrl, type: attachmentType })
            }
          />
        )}
        {message.body.length > 0 && <Text color={textColor} style={attachmentUrl !== null && s.bodyBelowAttachment}>{message.body}</Text>}
        {showTime && (
          <Text
            variant="caption"
            color={isMine ? 'rgba(255,255,255,0.7)' : theme.colors.content.tertiary}
            style={s.time}
          >
            {formatConvoTime(message.created_at)}
          </Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  rowLead: { marginTop: 8, marginBottom: 1 },
  rowCont: { marginTop: 1, marginBottom: 1 },
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
  bodyBelowAttachment: { marginTop: 6 },
})
