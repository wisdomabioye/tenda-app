import { Modal, View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { X } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
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
        <Pressable style={s.scrim} onPress={onClose} />

        <View style={[s.sheet, { backgroundColor: theme.colors.surface.background }]}>
          <View style={[s.grabber, { backgroundColor: theme.colors.border.strong }]} />
          <View style={s.header}>
            <Text style={s.title} color={theme.colors.content.primary}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                s.closeBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Close sheet"
              accessibilityRole="button"
            >
              <X size={14} color={theme.colors.content.secondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
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
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 22, 30, 0.35)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 16,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
})
