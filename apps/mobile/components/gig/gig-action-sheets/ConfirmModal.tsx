import { View, Modal, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'
import { Text } from '@/components/ui/Text'

export type ConfirmKind = 'accept' | 'cancel' | 'delete' | 'refund'

const COPY: Record<ConfirmKind, { title: string; body: string }> = {
  accept: {
    title: 'Accept this gig?',
    body: 'You will be responsible for completing this gig within the deadline.',
  },
  cancel: { title: 'Cancel this gig?', body: 'The escrow will be refunded to your wallet on-chain.' },
  refund: {
    title: 'Claim refund?',
    body: 'The escrowed funds will be returned to your wallet. This cannot be undone.',
  },
  delete: { title: 'Delete this draft?', body: 'This action cannot be undone.' },
}

/** Destructive/confirm dialog for the on-chain (and draft-delete) gig actions. */
export function ConfirmModal({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const { theme } = useUnistyles()
  const copy = kind !== null ? COPY[kind] : null

  return (
    <Modal visible={kind !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[s.overlay, { backgroundColor: theme.colors.surface.overlay }]}>
        <View style={[s.card, { backgroundColor: theme.colors.surface.card }]}>
          <Text variant="subheading">{copy?.title}</Text>
          <Spacer size={spacing.sm} />
          <Text variant="body" color={theme.colors.content.secondary}>{copy?.body}</Text>
          <Spacer size={spacing.lg} />
          <View style={s.ctaRow}>
            <Button variant="ghost" size="md" style={s.ctaFlex} onPress={onCancel}>
              Cancel
            </Button>
            <Button
              variant={kind === 'accept' ? 'primary' : 'danger'}
              size="md"
              style={s.ctaFlex}
              onPress={onConfirm}
            >
              Confirm
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
