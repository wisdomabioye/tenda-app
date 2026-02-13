import { type ReactNode } from 'react'
import { ActivityIndicator, Pressable, type PressableProps, View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import * as Haptics from 'expo-haptics'
import { radius, spacing, shadows } from '@/theme/tokens'
import { Text } from './Text'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
  children: string
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  size_sm: { paddingVertical: 10, paddingHorizontal: 16 },
  size_md: { paddingVertical: 14, paddingHorizontal: 22 },
  size_lg: { paddingVertical: 18, paddingHorizontal: 28 },
  size_xl: { paddingVertical: 22, paddingHorizontal: 32 },
  pressed: { opacity: 0.85 },
})

const textSize: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 17,
  xl: 18,
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  children,
  onPress,
  style,
  ...props
}: ButtonProps) {
  const { theme } = useUnistyles()
  const isDisabled = disabled || loading

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(e)
  }

  const variantBg: Record<Variant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.colors.danger,
  }

  const textColor = variant === 'primary' || variant === 'danger'
    ? theme.colors.onPrimary
    : variant === 'secondary'
      ? theme.colors.text
      : theme.colors.primary

  const spinnerColor = variant === 'primary' || variant === 'danger'
    ? theme.colors.onPrimary
    : theme.colors.primary

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={[
        s.base,
        s[`size_${size}`],
        { backgroundColor: variantBg[variant] },
        variant === 'primary' && shadows.sm,
        variant === 'outline' && { borderWidth: 1, borderColor: theme.colors.border },
        fullWidth && s.fullWidth,
        isDisabled && s.disabled,
        style as any,
      ]}
      {...props}
    >
      {({ pressed }) => loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={[s.content, pressed && s.pressed]}>
          {icon}
          <Text
            weight="semibold"
            color={isDisabled ? theme.colors.disabled : textColor}
            size={textSize[size]}
          >
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  )
}
