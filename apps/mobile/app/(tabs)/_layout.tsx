import { type ReactNode } from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Search, PlusCircle, User } from 'lucide-react-native'
import { typography, shadows, radius } from '@/theme/tokens'

const ICON_SIZE = 26

interface TabIconProps {
  icon: ReactNode
  focused: boolean
  color: string
}

function TabIcon({ icon, focused }: TabIconProps) {
  const { theme } = useUnistyles()

  return (
    <View style={[s.iconWrap, focused && { backgroundColor: theme.colors.primaryTint }]}>
      {icon}
    </View>
  )
}

export default function TabsLayout() {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

  const tabBarHeight = 72 + insets.bottom

  return (
    <Tabs
      screenOptions={() => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarLabelStyle: {
          fontFamily: typography.fonts.body.bold,
          fontSize: 11,
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.borderFaint,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          ...shadows.sm,
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
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
              focused={focused}
              color={color}
              icon={<Search color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 1.8} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: () => (
            <View style={[s.postIcon, { backgroundColor: theme.colors.primary }]}>
              <PlusCircle color={theme.colors.onPrimary} size={22} strokeWidth={2.2} />
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
              focused={focused}
              color={color}
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
    width: 40,
    height: 32,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
})
