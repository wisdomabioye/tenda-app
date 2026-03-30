import { useState } from 'react'
import { Platform, View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SendHorizontal } from 'lucide-react-native'
import { spacing, radius, typography } from '@/theme/tokens'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const canSend = text.trim().length > 0 && !disabled

  return (
    <View style={[s.container, { backgroundColor: theme.colors.surface.background, borderTopColor: theme.colors.border.subtle, paddingBottom: insets.bottom + spacing.sm }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        maxFontSizeMultiplier={1}
        placeholder="Message…"
        placeholderTextColor={theme.colors.content.tertiary}
        multiline
        maxLength={2000}
        style={[s.input, { color: theme.colors.content.primary, backgroundColor: theme.colors.control.inputBackground }]}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={[
          s.sendBtn,
          { backgroundColor: canSend ? theme.colors.brand.primary : theme.colors.border.subtle },
        ]}
      >
        <SendHorizontal size={18} color={canSend ? theme.colors.brand.onPrimary : theme.colors.content.tertiary} />
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
    fontSize: typography.styles.body.fontSize,
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
