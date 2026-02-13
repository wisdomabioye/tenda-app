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

const variantTokens = {
  success: { bg: 'successTint', fg: 'onSuccess' },
  warning: { bg: 'warningTint', fg: 'onWarning' },
  danger:  { bg: 'dangerTint',  fg: 'onDanger' },
  info:    { bg: 'infoTint',    fg: 'onInfo' },
  neutral: { bg: 'muted',       fg: 'mutedText' },
} as const

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
  const tokens = variantTokens[variant]

  return (
    <View style={[s.base, s[`size_${size}`], { backgroundColor: theme.colors[tokens.bg] }]}>
      <Text size={textSize[size]} weight="semibold" color={theme.colors[tokens.fg]}>
        {label}
      </Text>
    </View>
  )
}
