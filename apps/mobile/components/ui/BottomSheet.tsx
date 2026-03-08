import { Modal, View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { X } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Text } from './Text'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { theme } = useUnistyles()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Tap backdrop to dismiss */}
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={[s.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[s.handle, { backgroundColor: theme.colors.borderFaint }]} />
          <View style={s.header}>
            <Text variant="subheading">{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [s.closeBtn, { backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.muted }]}
            >
              <X size={16} color={theme.colors.textSub} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
