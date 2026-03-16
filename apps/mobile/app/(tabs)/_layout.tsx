import { useState, useRef } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Animated, StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context'
import { Home, Plus, Wallet, MessageCircle, ArrowLeftRight, ClipboardList, Coins } from 'lucide-react-native'
import { typography, shadows, radius } from '@/theme/tokens'
import { useChatStore } from '@/stores/chat.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { useConversationPolling } from '@/hooks/useConversationPolling'
import { FabMenu } from '@/components/ui/FabMenu'

const ICON_SIZE = 20
const POST_ICON_SIZE = 20

export default function TabsLayout() {
  const router       = useRouter()
  const { theme }    = useUnistyles()
  const insets       = useSafeAreaInsets()
  const unread       = useChatStore((s) => s.unread)
  const failedSyncs  = usePendingSyncStore((s) => s.failed.length)
  const [fabOpen, setFabOpen] = useState(false)
  const fabRotate    = useRef(new Animated.Value(0)).current

  useConversationPolling()

  function toggleFab() {
    const toValue = fabOpen ? 0 : 1
    setFabOpen(!fabOpen)
    Animated.spring(fabRotate, { toValue, useNativeDriver: true, damping: 14, stiffness: 200 }).start()
  }

  const fabSpin = fabRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] })

  // Use initialWindowMetrics as a stable fallback — on Android, screen wake briefly
  // reports insets as 0 before system bars finish rendering, causing a layout jump.
  const stableBottom = insets.bottom > 0 ? insets.bottom : (initialWindowMetrics?.insets.bottom ?? 0)
  const tabBarHeight = 78 + stableBottom

  const fabActions = [
    {
      icon:    <ClipboardList size={20} color={theme.colors.primary} />,
      label:   'Post a Gig',
      onPress: () => router.navigate('/(tabs)/post' as never),
    },
    {
      icon:    <Coins size={20} color={theme.colors.primary} />,
      label:   'Sell SOL',
      onPress: () => router.push('/exchange/create' as never),
    },
  ]

  return (
    <>
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
            paddingBottom: stableBottom + 4,
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
          name="exchange"
          options={{
            title: 'Trade',
            tabBarIcon: ({ color, focused }) => (
              <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
                <ArrowLeftRight color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="post"
          listeners={{
            tabPress: (e) => {
              e.preventDefault()
              toggleFab()
            },
          }}
          options={{
            title: '',
            tabBarIcon: () => (
              <Animated.View
                style={[
                  s.postIcon,
                  { backgroundColor: theme.colors.primary, transform: [{ rotate: fabSpin }] },
                ]}
              >
                <Plus color={theme.colors.onPrimary} size={POST_ICON_SIZE} strokeWidth={2.8} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'Wallet',
            tabBarBadge: failedSyncs > 0 ? (failedSyncs > 9 ? '9+' : failedSyncs) : undefined,
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
        <Tabs.Screen name="my-gigs" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="update-profile" options={{ href: null }} />
      </Tabs>

      <FabMenu
        visible={fabOpen}
        onClose={() => {
          setFabOpen(false)
          Animated.spring(fabRotate, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 200 }).start()
        }}
        actions={fabActions}
        bottomInset={tabBarHeight}
      />
    </>
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
