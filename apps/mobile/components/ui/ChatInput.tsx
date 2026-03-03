import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { SendHorizontal } from 'lucide-react-native'
import { spacing, radius, typography } from '@/theme/tokens'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { theme } = useUnistyles()
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const canSend = text.trim().length > 0 && !disabled

  return (
    <View style={[s.container, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderFaint }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message…"
        placeholderTextColor={theme.colors.textFaint}
        multiline
        maxLength={2000}
        style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.input }]}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={[
          s.sendBtn,
          { backgroundColor: canSend ? theme.colors.primary : theme.colors.borderFaint },
        ]}
      >
        <SendHorizontal size={18} color={canSend ? theme.colors.onPrimary : theme.colors.textFaint} />
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    fontFamily: typography.fonts.body.regular,
    fontSize: typography.sizes.base,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
