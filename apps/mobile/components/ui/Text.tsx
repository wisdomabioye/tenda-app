import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'

type Variant = 'heading' | 'subheading' | 'body' | 'caption' | 'label'
type Weight = 'regular' | 'medium' | 'semibold' | 'bold'

interface TextProps extends RNTextProps {
  variant?: Variant
  weight?: Weight
  color?: string
  align?: 'left' | 'center' | 'right'
  size?: number
}

const variantStyles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fonts.display.bold,
    lineHeight: typography.sizes['2xl'] * typography.lineHeights.tight,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.display.semibold,
    lineHeight: typography.sizes.lg * typography.lineHeights.tight,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.body.regular,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  caption: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body.regular,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body.medium,
    lineHeight: typography.sizes.sm * typography.lineHeights.tight,
  },
})

const weightStyles = StyleSheet.create({
  regular: { fontFamily: typography.fonts.body.regular },
  medium: { fontFamily: typography.fonts.body.medium },
  semibold: { fontFamily: typography.fonts.body.semibold },
  bold: { fontFamily: typography.fonts.body.bold },
})

export function Text({
  variant = 'body',
  weight,
  color,
  align,
  size,
  style,
  ...props
}: TextProps) {
  const { theme } = useUnistyles()

  return (
    <RNText
      style={[
        { color: variant === 'caption' ? theme.colors.textSub : theme.colors.text, fontFamily: typography.fonts.body.regular },
        variantStyles[variant],
        weight && weightStyles[weight],
        color !== undefined && { color },
        align !== undefined && { textAlign: align },
        size !== undefined && { fontSize: size },
        style,
      ]}
      {...props}
    />
  )
}
