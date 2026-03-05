import { useEffect, useRef } from 'react'
import { Tabs } from 'expo-router'
import { AppState, StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Briefcase, Plus, Wallet, MessageCircle } from 'lucide-react-native'
import { typography, shadows, radius } from '@/theme/tokens'
import { useChatStore } from '@/stores/chat.store'

const POLL_INTERVAL_MS = 15_000

const ICON_SIZE = 20
const POST_ICON_SIZE = 20

export default function TabsLayout() {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const unread = useChatStore((s) => s.unread)
  const appState = useRef(AppState.currentState)

  // Poll conversations in the background so the unread badge stays current
  // regardless of which tab the user is on. Pauses when the app is backgrounded.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function schedule() {
      timer = setTimeout(run, POLL_INTERVAL_MS)
    }

    async function run() {
      if (cancelled) return
      try {
        await useChatStore.getState().fetchConversations()
      } catch {
        // polling errors are silent — the badge just won't update this cycle
      }
      if (!cancelled) schedule()
    }

    run()

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        if (timer) clearTimeout(timer)
        run()
      } else if (next.match(/inactive|background/)) {
        if (timer) clearTimeout(timer)
      }
      appState.current = next
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      sub.remove()
    }
  }, [])

  const tabBarHeight = 78 + insets.bottom

  return (
    <Tabs
      backBehavior="history"
      screenOptions={() => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarLabelStyle: {
          fontFamily: typography.fonts.body.bold,
          fontSize: 11,
          letterSpacing: 0.3,
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.borderFaint,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 10,
          paddingBottom: insets.bottom + 4,
          ...shadows.md,
        },
      })}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
              <Home color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="my-gigs"
        options={{
          title: 'My Gigs',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
              <Briefcase color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[s.postIcon, { backgroundColor: theme.colors.primary }]}>
              <Plus color={theme.colors.onPrimary} size={POST_ICON_SIZE} strokeWidth={2.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
              <Wallet color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
              <MessageCircle color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />
            </View>
          ),
        }}
      />

      {/* ── Hidden screens (navigable, no tab) ── */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="update-profile" options={{ href: null }} />
    </Tabs>
  )
}

const s = StyleSheet.create({
  iconWrap: {
    width: 48,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postIcon: {
    width: 52,
    height: 52,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadows.lg,
  },
})
