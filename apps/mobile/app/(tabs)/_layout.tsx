import { type ReactNode } from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Search, PlusCircle, User } from 'lucide-react-native'
import { typography, shadows, radius } from '@/theme/tokens'

const ICON_SIZE = 26
const POST_ICON_SIZE = 20

interface TabIconProps {
  icon: ReactNode
}

function TabIcon({ icon }: TabIconProps) {
  return (
    <View style={s.iconWrap}>
      {icon}
    </View>
  )
}

export default function TabsLayout() {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

  const tabBarHeight = 78 + insets.bottom

  return (
    <Tabs
      screenOptions={() => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarLabelStyle: {
          fontFamily: typography.fonts.body.bold,
          fontSize: 12,
          marginTop: 6,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.borderFaint,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 10,
          paddingBottom: insets.bottom,
          ...shadows.md,
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Home color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Search color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarLabelStyle: {
            fontFamily: typography.fonts.body.bold,
            fontSize: 12,
            marginTop: 10,
          },
          tabBarIconStyle: { marginBottom: 6 },
          tabBarIcon: () => (
            <View style={[s.postIcon, { backgroundColor: theme.colors.primary }]}>
              <PlusCircle color={theme.colors.onPrimary} size={POST_ICON_SIZE} strokeWidth={2.2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<User color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />}
            />
          ),
        }}
      />
    </Tabs>
  )
}

const s = StyleSheet.create({
  iconWrap: {
    width: 52,
    height: 38,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  postIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
})
