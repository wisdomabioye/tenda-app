import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ArrowLeft } from 'lucide-react-native';
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
        paddingVertical: theme.spacing.sm,
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
            style={styles.backButton}
          >
            <ArrowLeft size={22} color={theme.colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.center}>
        {title && (
          <Text
            style={[
              styles.title,
              {
                fontSize: theme.typography.sizes.base,
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
            <RightIcon size={18} color={theme.colors.primary} />
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
    minHeight: 52,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
  },
});
