import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Menu } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Text, Avatar } from '@/components/ui'

interface DrawerHeaderProps {
  title?: string
  onMenuPress: () => void
  rightIcon?: LucideIcon
  onRightPress?: () => void
  onAvatarPress?: () => void
  userImage?: string | null
  userName?: string
  showAvatar?: boolean
}

export function DrawerHeader({
  title = 'Tenda',
  onMenuPress,
  rightIcon: RightIcon,
  onRightPress,
  onAvatarPress,
  userImage,
  userName,
  showAvatar = true,
}: DrawerHeaderProps) {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        s.hdr,
        {
          paddingTop: insets.top,
          backgroundColor: theme.colors.surface.background,
          borderBottomColor: theme.colors.border.subtle,
        },
      ]}
    >
      <Pressable
        onPress={onMenuPress}
        style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
        accessibilityLabel="Open menu"
        accessibilityRole="button"
      >
        <Menu size={18} color={theme.colors.content.secondary} />
      </Pressable>

      <View style={s.center}>
        <Text style={[s.title, { color: theme.colors.content.primary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={s.right}>
        {RightIcon && (
          <Pressable
            onPress={onRightPress}
            style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <RightIcon size={18} color={theme.colors.content.secondary} />
          </Pressable>
        )}
        {showAvatar && (
          <Pressable onPress={onAvatarPress} hitSlop={4}>
            <Avatar src={userImage} name={userName} size="sm" />
          </Pressable>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.17,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
