import { useCallback, useState } from 'react'
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useFocusEffect } from 'expo-router'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Card, Divider, Header } from '@/components/ui'
import { ErrorState } from '@/components/feedback'
import { useSettingsStore } from '@/stores/settings.store'
import { Check, Bell, Trash2 } from 'lucide-react-native'
import { api } from '@/api/client'
import { showToast } from '@/components/ui/Toast'
import type { GigSubscription } from '@tenda/shared'

type Theme = 'light' | 'dark' | 'system'

const THEME_OPTIONS: Array<{ value: Theme; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
  { value: 'system', label: 'System', description: 'Follow device settings' },
]

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const { theme: currentTheme, setTheme } = useSettingsStore()
  const [subscriptions, setSubscriptions] = useState<GigSubscription[]>([])
  const [loadingSubs,   setLoadingSubs]   = useState(false)
  const [subsError,     setSubsError]     = useState(false)

  const loadSubscriptions = useCallback(() => {
    setLoadingSubs(true)
    setSubsError(false)
    api.subscriptions.list()
      .then(setSubscriptions)
      .catch(() => setSubsError(true))
      .finally(() => setLoadingSubs(false))
  }, [])

  useFocusEffect(loadSubscriptions)

  async function addSubscription() {
    try {
      const sub = await api.subscriptions.upsert({})
      setSubscriptions((prev) => {
        const exists = prev.find((s) => s.id === sub.id)
        return exists ? prev : [sub, ...prev]
      })
      showToast('success', 'Subscribed to all new gigs')
    } catch {
      showToast('error', 'Failed to subscribe')
    }
  }

  async function removeSubscription(id: string) {
    try {
      await api.subscriptions.remove({ id })
      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
    } catch {
      showToast('error', 'Failed to remove subscription')
    }
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Settings" showBack />
      <Spacer size={spacing.lg} />

      {/* Theme */}
      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        APPEARANCE
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        {THEME_OPTIONS.map((opt, index) => {
          const selected = currentTheme === opt.value
          return (
            <View key={opt.value}>
              {index > 0 && <Divider spacing={0} />}
              <Pressable
                onPress={() => setTheme(opt.value)}
                style={({ pressed }) => [
                  s.row,
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <View style={s.rowLeft}>
                  <Text weight="medium">{opt.label}</Text>
                  <Text variant="caption" color={theme.colors.textSub}>{opt.description}</Text>
                </View>
                {selected && (
                  <Check size={20} color={theme.colors.primary} />
                )}
              </Pressable>
            </View>
          )
        })}
      </Card>

      <Spacer size={spacing.lg} />

      {/* Currency */}
      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        CURRENCY
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        <Pressable style={s.row}>
          <View style={s.rowLeft}>
            <Text weight="medium">Nigerian Naira (NGN)</Text>
            <Text variant="caption" color={theme.colors.textSub}>₦ — default display currency</Text>
          </View>
          <Check size={20} color={theme.colors.primary} />
        </Pressable>
      </Card>

      <Spacer size={spacing.lg} />

      {/* Gig Subscriptions */}
      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        GIG NOTIFICATIONS
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        {loadingSubs ? (
          <View style={s.row}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : subsError ? (
          <ErrorState
            title="Couldn't load subscriptions"
            description="Tap to try again."
            ctaLabel="Retry"
            onCtaPress={loadSubscriptions}
            style={{ flex: 0, paddingVertical: spacing.xl }}
          />
        ) : (
          <>
            {subscriptions.map((sub, index) => (
              <View key={sub.id}>
                {index > 0 && <Divider spacing={0} />}
                <View style={s.row}>
                  <View style={s.rowLeft}>
                    <View style={s.subIconRow}>
                      <Bell size={14} color={theme.colors.primary} />
                      <Text weight="medium">
                        {sub.city === '*' ? 'All cities' : sub.city}
                        {sub.category !== '*' ? ` · ${sub.category}` : ''}
                      </Text>
                    </View>
                    <Text variant="caption" color={theme.colors.textSub}>New gigs matching this filter</Text>
                  </View>
                  <Pressable onPress={() => removeSubscription(sub.id)} style={s.trashBtn}>
                    <Trash2 size={16} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Divider spacing={0} />
            <Pressable
              onPress={addSubscription}
              style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.colors.surfacePressed }]}
            >
              <Text color={theme.colors.primary} weight="medium">+ Subscribe to new gigs</Text>
            </Pressable>
          </>
        )}
      </Card>

      <Spacer size={spacing.lg} />

      {/* App info */}
      <Text variant="caption" color={theme.colors.textFaint} align="center">
        Tenda v1.0.0
      </Text>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    paddingHorizontal: 4,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  subIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trashBtn: {
    padding: 4,
  },
})
