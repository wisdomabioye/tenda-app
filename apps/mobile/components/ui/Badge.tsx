import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius } from '@/theme/tokens'
import { Text } from './Text'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type Size = 'sm' | 'md'

interface BadgeProps {
  variant?: Variant
  label: string
  size?: Size
}

type FeedbackVariant = Exclude<Variant, 'neutral'>

const textSize: Record<Size, number> = {
  sm: 12,
  md: 14,
}

const s = StyleSheet.create({
  base: { borderRadius: radius.full, alignSelf: 'flex-start' as const },
  size_sm: { paddingVertical: 2, paddingHorizontal: 10 },
  size_md: { paddingVertical: 4, paddingHorizontal: 14 },
})

export function Badge({ variant = 'neutral', label, size = 'sm' }: BadgeProps) {
  const { theme } = useUnistyles()

  const bg = variant === 'neutral'
    ? theme.colors.surface.backgroundAlt
    : theme.colors.feedback[variant as FeedbackVariant].surface
  const fg = variant === 'neutral'
    ? theme.colors.content.secondary
    : theme.colors.feedback[variant as FeedbackVariant].text

  return (
    <View style={[s.base, s[`size_${size}`], { backgroundColor: bg }]}>
      <Text size={textSize[size]} weight="semibold" color={fg}>
        {label}
      </Text>
    </View>
  )
}
