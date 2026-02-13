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
  userImage?: string | null;
  userName?: string;
  showAvatar?: boolean;
}

export function DrawerHeader({
  onMenuPress,
  rightIcon: RightIcon,
  onRightPress,
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
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.muted,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
        activeOpacity={0.7}
      >
        <Menu size={22} color={theme.colors.primary} />
      </TouchableOpacity>

      <Image
        source={Logo}
        style={{
          width: 136,
          height: 44,
        }}
        contentFit="contain"
      />

      {showAvatar ? (
        <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
          <Avatar src={userImage} name={userName} size="lg" />
        </TouchableOpacity>
      ) : RightIcon ? (
        <TouchableOpacity
          onPress={onRightPress}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.md,
          }}
          activeOpacity={0.7}
        >
          <RightIcon size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );
}
