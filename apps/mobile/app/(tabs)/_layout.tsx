import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Briefcase, Plus, Wallet } from 'lucide-react-native'
import { typography, shadows, radius } from '@/theme/tokens'

const ICON_SIZE = 24
const POST_ICON_SIZE = 24

export default function TabsLayout() {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

  const tabBarHeight = 88 + insets.bottom

  return (
    <Tabs
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
          paddingTop: 12,
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

      {/* ── Hidden screens (navigable, no tab) ── */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      {/* <Tabs.Screen name="search" options={{ href: null }} /> */}
      {/* <Tabs.Screen name="notifications" options={{ href: null }} /> */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="update-profile" options={{ href: null }} />
      {/* <Tabs.Screen name="invite" options={{ href: null }} /> */}
      {/* <Tabs.Screen name="currency" options={{ href: null }} /> */}
      {/* <Tabs.Screen name="messages" options={{ href: null }} /> */}
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadows.lg,
  },
})
