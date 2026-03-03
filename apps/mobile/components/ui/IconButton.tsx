import { type ReactNode } from 'react'
import { Pressable, type PressableProps, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import * as Haptics from 'expo-haptics'
import { radius } from '@/theme/tokens'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: ReactNode
  variant?: Variant
  size?: Size
  haptic?: boolean
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  size_sm: { width: 28, height: 28 },
  size_md: { width: 34, height: 34 },
  size_lg: { width: 42, height: 42 },
})

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  haptic = false,
  onPress,
  disabled,
  style,
  ...props
}: IconButtonProps) {
  const { theme } = useUnistyles()

  const handlePress = (e: any) => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(e)
  }

  const variantBg: Record<Variant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    ghost: 'transparent',
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[
        s.base,
        s[`size_${size}`],
        { backgroundColor: variantBg[variant] },
        disabled && s.disabled,
        style as any,
      ]}
      {...props}
    >
      {icon}
    </Pressable>
  )
}
