import { View, Modal, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button } from './Button'
import { Spacer } from './Spacer'
import { Text } from './Text'

export interface ConfirmDialogProps {
  visible: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in the danger style (irreversible/destructive). */
  destructive?: boolean
  /** Shows a spinner on the confirm button while the action is in flight. */
  loading?: boolean
  /** Drop the cancel button — an acknowledge-only notice (single action). */
  hideCancel?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The app's styled confirm/cancel dialog — the custom replacement for the native
 * `Alert.alert(...)` two-button prompt. Centered card over a dimmed overlay,
 * themed via unistyles. Controlled by `visible`; the caller owns the open state
 * and the confirm/cancel handlers. Use `showToast` for fire-and-forget notices
 * (this is only for decisions the user must confirm or cancel).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { theme } = useUnistyles()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[s.overlay, { backgroundColor: theme.colors.surface.overlay }]}>
        <View style={[s.card, { backgroundColor: theme.colors.surface.card }]}>
          <Text variant="subheading">{title}</Text>
          {message !== undefined && message !== '' ? (
            <>
              <Spacer size={spacing.sm} />
              <Text variant="body" color={theme.colors.content.secondary}>{message}</Text>
            </>
          ) : null}
          <Spacer size={spacing.lg} />
          <View style={s.ctaRow}>
            {!hideCancel ? (
              <Button variant="ghost" size="md" style={s.ctaFlex} onPress={onCancel}>
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              variant={destructive ? 'danger' : 'primary'}
              size="md"
              style={s.ctaFlex}
              loading={loading}
              onPress={onConfirm}
            >
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 340, borderRadius: radius.xl, padding: spacing.lg },
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  ctaFlex: { flex: 1 },
})
