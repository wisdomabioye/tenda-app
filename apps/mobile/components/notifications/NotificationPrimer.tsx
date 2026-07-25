import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Bell } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { BottomSheet, Text, Button, Spacer } from '@/components/ui'
import { PRIMER_COPY, SETTINGS_CONFIRM_LABEL, type PrimerReason } from './primerCopy'

interface NotificationPrimerProps {
  visible: boolean
  reason: PrimerReason
  /**
   * False when the OS prompt is already spent, the confirm button then promises
   * Settings rather than a dialog that would never appear.
   */
  canAskAgain: boolean
  /** Resolves to whether notifications ended up enabled. */
  onConfirm: () => Promise<boolean>
  onDismiss: () => void
}

/**
 * The soft ask. Shown before the system dialog so a "no" costs us our own sheet
 * rather than the one-shot OS prompt, which on iOS can never be re-shown.
 * Dismissing must never reach the permission API.
 */
export function NotificationPrimer({
  visible,
  reason,
  canAskAgain,
  onConfirm,
  onDismiss,
}: NotificationPrimerProps) {
  const { theme } = useUnistyles()
  const [isAsking, setIsAsking] = useState(false)
  const copy = PRIMER_COPY[reason]

  async function handleConfirm() {
    setIsAsking(true)
    try {
      await onConfirm()
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onDismiss} title={copy.title}>
      <View style={s.iconRow}>
        <View style={[s.icon, { backgroundColor: theme.colors.brand.primarySurface }]}>
          <Bell size={28} color={theme.colors.brand.primary} />
        </View>
      </View>
      <Spacer size={spacing.md} />
      <Text variant="body" align="center" color={theme.colors.content.secondary}>
        {copy.body}
      </Text>
      <Spacer size={spacing.lg} />
      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isAsking}
        onPress={handleConfirm}
        accessibilityLabel={canAskAgain ? copy.confirmLabel : SETTINGS_CONFIRM_LABEL}
      >
        {canAskAgain ? copy.confirmLabel : SETTINGS_CONFIRM_LABEL}
      </Button>
      <Spacer size={spacing.sm} />
      <Button variant="ghost" size="lg" fullWidth disabled={isAsking} onPress={onDismiss}>
        {copy.dismissLabel}
      </Button>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  iconRow: { alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
})
