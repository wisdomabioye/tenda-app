import { useCallback, useState } from 'react'
import { View, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { Sun, Moon, Smartphone, Bell, Trash2, HelpCircle, ChevronRight, Plus, Check } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Header, showToast } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ErrorState } from '@/components/feedback'
import { useSettingsStore } from '@/stores/settings.store'
import { api } from '@/api/client'
import { SUPPORTED_CURRENCIES, CURRENCY_META } from '@tenda/shared'
import type { GigSubscription, SupportedCurrency } from '@tenda/shared'

type ThemeChoice = 'light' | 'dark' | 'system'

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Smartphone },
]

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { theme: currentTheme, setTheme, currency, setCurrency } = useSettingsStore()
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false)
  const [subscriptions, setSubscriptions] = useState<GigSubscription[]>([])
  const [loadingSubs,   setLoadingSubs]   = useState(false)
  const [subsError,     setSubsError]     = useState(false)
  const [notifDenied,   setNotifDenied]   = useState(false)

  const loadSubscriptions = useCallback(() => {
    setLoadingSubs(true)
    setSubsError(false)
    api.subscriptions.list()
      .then(setSubscriptions)
      .catch(() => setSubsError(true))
      .finally(() => setLoadingSubs(false))
  }, [])

  useFocusEffect(useCallback(() => {
    loadSubscriptions()
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifDenied(status === 'denied')
    })
  }, [loadSubscriptions]))

  async function addSubscription() {
    if (notifDenied) return
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

  const currencyMeta = CURRENCY_META[currency]

  return (
    <ScreenContainer scroll padding={false} edges={['left', 'right']}>
      <Header title="Settings" showBack />

      {/* Appearance — compact segmented control */}
      <SectionLabel tight>Appearance</SectionLabel>
      <View style={[s.segment, { backgroundColor: theme.colors.surface.inset }]}>
        {THEME_OPTIONS.map((opt) => {
          const selected = currentTheme === opt.value
          const Icon = opt.Icon
          return (
            <Pressable
              key={opt.value}
              onPress={() => setTheme(opt.value)}
              style={({ pressed }) => [
                s.segmentItem,
                selected && {
                  backgroundColor: theme.colors.surface.card,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
                pressed && !selected && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Icon
                size={15}
                color={selected ? theme.colors.brand.primary : theme.colors.content.tertiary}
                strokeWidth={selected ? 2.25 : 2}
              />
              <Text
                style={[
                  s.segmentLabel,
                  { color: selected ? theme.colors.content.primary : theme.colors.content.tertiary },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Preferences */}
      <SectionLabel>Preferences</SectionLabel>
      <View style={[s.group, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}>
        <Pressable
          onPress={() => setCurrencySheetOpen(true)}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.colors.surface.pressed }]}
        >
          <View style={[s.rowIc, { backgroundColor: theme.colors.surface.inset }]}>
            <Text style={s.rowIcFlag}>{currencyMeta.flag}</Text>
          </View>
          <Text style={[s.rowLabel, { color: theme.colors.content.primary }]} numberOfLines={1}>
            Currency
          </Text>
          <Text style={[s.rowValue, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
            {currency} · {currencyMeta.symbol}
          </Text>
          <ChevronRight size={16} color={theme.colors.content.tertiary} />
        </Pressable>
      </View>

      {/* Notifications */}
      <SectionLabel>Notifications</SectionLabel>
      {notifDenied && (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [
            s.banner,
            { backgroundColor: theme.colors.feedback.warning.surface },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[s.bannerDot, { backgroundColor: theme.colors.feedback.warning.base }]} />
          <Text style={[s.bannerText, { color: theme.colors.content.primary }]}>
            <Text style={{ fontWeight: '600' }}>Notifications are off.</Text> Enable in iOS Settings to get alerts.
          </Text>
          <Text style={[s.bannerAction, { color: theme.colors.brand.primary }]}>Enable</Text>
        </Pressable>
      )}
      <View style={[s.group, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}>
        {loadingSubs ? (
          <View style={s.row}>
            <ActivityIndicator size="small" color={theme.colors.brand.primary} />
          </View>
        ) : subsError ? (
          <ErrorState
            title="Couldn't load subscriptions"
            description="Tap to try again."
            ctaLabel="Retry"
            onCtaPress={loadSubscriptions}
            style={{ flex: 0, paddingVertical: 24 }}
          />
        ) : (
          <>
            {subscriptions.map((sub, index) => (
              <View key={sub.id}>
                {index > 0 && (
                  <View style={[s.rowDivider, { backgroundColor: theme.colors.border.subtle }]} />
                )}
                <View style={s.subRow}>
                  <View style={[s.subIc, { backgroundColor: theme.colors.brand.primarySurface }]}>
                    <Bell size={15} color={theme.colors.brand.primary} />
                  </View>
                  <View style={s.subBody}>
                    <Text style={[s.subFilters, { color: theme.colors.content.primary }]} numberOfLines={1}>
                      {formatSubLabel(sub)}
                    </Text>
                    <Text style={[s.subHint, { color: theme.colors.content.secondary }]} numberOfLines={1}>
                      Notify me on new matches
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeSubscription(sub.id)}
                    style={({ pressed }) => [s.subTrash, pressed && { opacity: 0.6 }]}
                    hitSlop={8}
                    accessibilityLabel="Remove subscription"
                  >
                    <Trash2 size={15} color={theme.colors.content.tertiary} />
                  </Pressable>
                </View>
              </View>
            ))}
            {subscriptions.length > 0 && (
              <View style={[s.rowDivider, { backgroundColor: theme.colors.border.subtle }]} />
            )}
            <Pressable
              onPress={addSubscription}
              disabled={notifDenied}
              style={({ pressed }) => [
                s.addRow,
                notifDenied && { opacity: 0.55 },
                pressed && !notifDenied && { backgroundColor: theme.colors.surface.pressed },
              ]}
            >
              <View
                style={[
                  s.addPlus,
                  notifDenied
                    ? { backgroundColor: theme.colors.surface.inset }
                    : { backgroundColor: theme.colors.brand.primarySurface },
                ]}
              >
                <Plus
                  size={18}
                  color={notifDenied ? theme.colors.content.tertiary : theme.colors.brand.primary}
                  strokeWidth={2}
                />
              </View>
              <Text
                style={[
                  s.addText,
                  { color: notifDenied ? theme.colors.content.tertiary : theme.colors.brand.primary },
                ]}
              >
                Subscribe to new gigs
              </Text>
            </Pressable>
          </>
        )}
      </View>
      {notifDenied && (
        <Text style={[s.notifHint, { color: theme.colors.content.tertiary }]}>
          Re-enable notifications to add subscriptions.
        </Text>
      )}

      {/* Help */}
      <SectionLabel>Help</SectionLabel>
      <View style={[s.group, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}>
        <Pressable
          onPress={() => router.push('/(support)' as Parameters<typeof router.push>[0])}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.colors.surface.pressed }]}
        >
          <View style={[s.rowIc, { backgroundColor: theme.colors.surface.inset }]}>
            <HelpCircle size={16} color={theme.colors.content.primary} />
          </View>
          <Text style={[s.rowLabel, { color: theme.colors.content.primary }]}>Help & Guide</Text>
          <View style={{ flex: 1 }} />
          <ChevronRight size={16} color={theme.colors.content.tertiary} />
        </Pressable>
      </View>

      <Text style={[s.version, { color: theme.colors.content.tertiary }]}>Tenda v1.0.0</Text>
      <Spacer size={20} />

      <BottomSheet title="Display currency" visible={currencySheetOpen} onClose={() => setCurrencySheetOpen(false)}>
        {SUPPORTED_CURRENCIES.map((c) => {
          const meta = CURRENCY_META[c as SupportedCurrency]
          const selected = currency === c
          return (
            <Pressable
              key={c}
              onPress={() => { setCurrency(c as SupportedCurrency); setCurrencySheetOpen(false) }}
              style={({ pressed }) => [s.ccyRow, pressed && { backgroundColor: theme.colors.surface.pressed }]}
            >
              <View style={[s.ccyFlag, { backgroundColor: theme.colors.surface.inset }]}>
                <Text style={s.ccyFlagText}>{meta.flag}</Text>
              </View>
              <View style={s.ccyMeta}>
                <Text style={[s.ccyCode, { color: theme.colors.content.primary }]}>
                  {c} <Text style={{ color: theme.colors.content.tertiary, fontWeight: '400' }}>· {meta.symbol}</Text>
                </Text>
                <Text style={[s.ccyName, { color: theme.colors.content.tertiary }]}>{meta.name}</Text>
              </View>
              {selected && (
                <View style={[s.checkPill, { backgroundColor: theme.colors.brand.primary }]}>
                  <Check size={13} color={theme.colors.brand.onPrimary} strokeWidth={3} />
                </View>
              )}
            </Pressable>
          )
        })}
      </BottomSheet>
    </ScreenContainer>
  )
}

function formatSubLabel(sub: GigSubscription): string {
  const parts: string[] = []
  parts.push(sub.city === '*' ? 'All cities' : sub.city)
  if (sub.category && sub.category !== '*') parts.push(sub.category)
  return parts.join(' · ')
}

const s = StyleSheet.create({
  group: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIc: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcSym: {
    fontSize: 17,
    fontWeight: '700',
    includeFontPadding: false,
  },
  rowIcFlag: {
    fontSize: 18,
    includeFontPadding: false,
  },
  segment: {
    marginHorizontal: 20,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 9,
  },
  segmentLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.135,
  },
  rowLabel: {
    fontSize: 15,
    letterSpacing: -0.075,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    letterSpacing: 0.13,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  rowDivider: {
    height: 1,
    marginLeft: 72,
  },
  checkPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 20,
    marginBottom: 8,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  bannerAction: {
    fontSize: 13.5,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flexShrink: 0,
  },
  subRow: {
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subIc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBody: {
    flex: 1,
    minWidth: 0,
  },
  subFilters: {
    fontSize: 14,
    letterSpacing: -0.14,
  },
  subHint: {
    fontSize: 12.5,
    marginTop: 2,
    letterSpacing: -0.063,
  },
  subTrash: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addPlus: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifHint: {
    paddingHorizontal: 20,
    paddingTop: 10,
    fontSize: 12.5,
    lineHeight: 17,
  },
  version: {
    textAlign: 'center',
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.44,
    marginTop: 34,
  },
  ccyRow: {
    height: 52,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ccyFlag: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ccyFlagText: {
    fontSize: 18,
    includeFontPadding: false,
  },
  ccyMeta: {
    flex: 1,
    minWidth: 0,
  },
  ccyCode: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  ccyName: {
    fontSize: 12.5,
    marginTop: 1,
  },
})
