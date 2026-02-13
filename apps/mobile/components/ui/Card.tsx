import { type ReactNode } from 'react'
import { Pressable, View, type ViewProps, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing, shadows } from '@/theme/tokens'

type Variant = 'elevated' | 'outlined' | 'filled'

interface CardProps extends ViewProps {
  variant?: Variant
  padding?: number
  onPress?: () => void
  children: ReactNode
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
})

export function Card({
  variant = 'elevated',
  padding,
  onPress,
  children,
  style,
  ...props
}: CardProps) {
  const { theme } = useUnistyles()

  const variantStyle = variant === 'elevated'
    ? { backgroundColor: theme.colors.surface, ...shadows.md }
    : variant === 'outlined'
      ? { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }
      : { backgroundColor: theme.colors.surface }

  const content = (
    <View
      style={[
        s.base,
        variantStyle,
        padding !== undefined && { padding },
        !onPress && (style as any),
      ]}
      {...(!onPress ? props : {})}
    >
      {children}
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={style as any} {...props}>
        {content}
      </Pressable>
    )
  }

  return content
}
