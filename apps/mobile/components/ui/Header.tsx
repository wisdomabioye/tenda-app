import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChevronLeft } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightIcon?: LucideIcon;
  onRightPress?: () => void;
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  rightIcon: RightIcon,
  onRightPress,
  transparent = false,
}: HeaderProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[
      styles.container,
      {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      },
      transparent ? { backgroundColor: 'transparent' } : {
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderFaint,
      },
    ]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable
            onPress={handleBack}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ChevronLeft size={22} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.center}>
        {title && (
          <Text
            style={[
              styles.title,
              {
                fontSize: theme.typography.sizes.xl,
                color: theme.colors.text,
                fontFamily: theme.typography.fonts.display.bold,
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.textSub,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {RightIcon && (
          <Pressable
            onPress={onRightPress}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <RightIcon size={20} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  left: {
    width: 52,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 52,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
  },
});
