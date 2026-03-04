import { View, TouchableOpacity } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Menu } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Avatar } from '@/components/ui'

const Logo = require('@/assets/images/logo.png')

interface DrawerHeaderProps {
  title?: string;
  onMenuPress: () => void;
  rightIcon?: LucideIcon;
  onRightPress?: () => void;
  onAvatarPress?: () => void;
  userImage?: string | null;
  userName?: string;
  showAvatar?: boolean;
}

export function DrawerHeader({
  onMenuPress,
  rightIcon: RightIcon,
  onRightPress,
  onAvatarPress,
  userImage,
  userName,
  showAvatar = true,
}: DrawerHeaderProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + theme.spacing.sm,
        paddingBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <TouchableOpacity
        onPress={onMenuPress}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.muted,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
        activeOpacity={0.7}
      >
        <Menu size={18} color={theme.colors.primary} />
      </TouchableOpacity>

      <Image
        source={Logo}
        style={{
          width: 36,
          height: 34,
        }}
        contentFit="contain"
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
       {/*  {RightIcon && (
          <TouchableOpacity
            onPress={onRightPress}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.md,
            }}
            activeOpacity={0.7}
          >
            <RightIcon size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )} */}
        {showAvatar && (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
            <Avatar src={userImage} name={userName} size="md" />
          </TouchableOpacity>
        )}
        {!showAvatar && !RightIcon && <View style={{ width: 36 }} />}
      </View>
    </View>
  );
}
