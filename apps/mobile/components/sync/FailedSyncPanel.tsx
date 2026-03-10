import { useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { AlertTriangle, ChevronRight, RotateCcw, X } from 'lucide-react-native'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text, Spacer, BottomSheet } from '@/components/ui'
import { usePendingSyncStore, PENDING_SYNC_ACTION_LABEL, type PendingSync } from '@/stores/pending-sync.store'

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    marginLeft: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemActions: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
})

function FailedSyncItem({
  item,
  onRetry,
  onDismiss,
}: {
  item: PendingSync
  onRetry: () => void
  onDismiss: () => void
}) {
  const { theme } = useUnistyles()
  const date = new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })

  return (
    <View style={[s.item, { borderBottomColor: theme.colors.borderFaint }]}>
      <View style={[s.itemIcon, { backgroundColor: theme.colors.warningTint }]}>
        <AlertTriangle size={14} color={theme.colors.warning} />
      </View>

      <View style={s.itemBody}>
        <Text weight="semibold" size={typography.sizes.sm}>{PENDING_SYNC_ACTION_LABEL[item.action]}</Text>
        <Text variant="caption" color={theme.colors.textFaint} numberOfLines={1}>
          Sig: {item.signature.slice(0, 16)}…
        </Text>
        <Text variant="caption" color={theme.colors.textFaint}>{date}</Text>
      </View>

      <View style={s.itemActions}>
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          style={[s.actionBtn, { backgroundColor: theme.colors.primaryTint }]}
        >
          <RotateCcw size={12} color={theme.colors.primary} />
          <Text size={12} weight="semibold" color={theme.colors.primary}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={[s.actionBtn, { backgroundColor: theme.colors.muted }]}
        >
          <X size={12} color={theme.colors.textSub} />
          <Text size={12} weight="medium" color={theme.colors.textSub}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  )
}

/**
 * Self-contained component that renders a warning banner when pending-sync items have
 * exceeded max retries and moved to the dead-letter queue. Tapping the banner opens a
 * bottom sheet where the user can retry or dismiss each failed item individually.
 *
 * Drop into any screen's header — renders nothing when the failed queue is empty.
 */
export function FailedSyncPanel() {
  const { theme } = useUnistyles()
  const failed        = usePendingSyncStore((s) => s.failed)
  const retryFailed   = usePendingSyncStore((s) => s.retryFailed)
  const dismissFailed = usePendingSyncStore((s) => s.dismissFailed)

  const [sheetVisible, setSheetVisible] = useState(false)

  if (failed.length === 0) return null

  function handleRetry(id: string) {
    retryFailed(id)
    if (failed.length === 1) setSheetVisible(false)
  }

  function handleDismiss(id: string) {
    dismissFailed(id)
    if (failed.length === 1) setSheetVisible(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setSheetVisible(true)}
        style={[s.banner, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning, marginBottom: spacing.md }]}
      >
        <AlertTriangle size={16} color={theme.colors.warning} />
        <View style={s.bannerText}>
          <Text weight="semibold" size={typography.sizes.sm} color={theme.colors.warning}>
            {failed.length} transaction{failed.length > 1 ? 's' : ''} need attention
          </Text>
          <Text variant="caption" color={theme.colors.warning} style={{ opacity: 0.8 }}>
            Tap to review and retry
          </Text>
        </View>
        <ChevronRight size={16} color={theme.colors.warning} />
      </Pressable>

      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Transactions Needing Attention"
      >
        <Text variant="caption" color={theme.colors.textSub} style={{ marginBottom: spacing.md }}>
          These transactions were confirmed on-chain but could not be recorded on our server.
          Retry to sync them, or dismiss if the gig status already looks correct.
        </Text>
        {failed.map((item) => (
          <FailedSyncItem
            key={item.id}
            item={item}
            onRetry={() => handleRetry(item.id)}
            onDismiss={() => handleDismiss(item.id)}
          />
        ))}
        <Spacer size={spacing.sm} />
      </BottomSheet>
    </>
  )
}
