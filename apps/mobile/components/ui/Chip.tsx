import { type ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, typography } from '@/theme/tokens'
import { Text } from './Text'

interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  color?: string
  icon?: ReactNode
}

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    alignSelf: 'flex-start' as const,
  },
})

export function Chip({ label, selected = false, onPress, color, icon }: ChipProps) {
  const { theme } = useUnistyles()

  const bgColor = selected ? color ?? theme.colors.brand.primary : theme.colors.surface.backgroundAlt
  const textColor = selected ? theme.colors.brand.onPrimary : theme.colors.content.primary

  return (
    <Pressable onPress={onPress} style={[s.base, { backgroundColor: bgColor }]}>
      {icon}
      <Text size={typography.styles.caption.fontSize} weight="medium" color={textColor}>{label}</Text>
    </Pressable>
  )
}
