import { type ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius } from '@/theme/tokens'
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
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    alignSelf: 'flex-start' as const,
  },
})

export function Chip({ label, selected = false, onPress, color, icon }: ChipProps) {
  const { theme } = useUnistyles()

  const bgColor = selected ? color ?? theme.colors.primary : theme.colors.muted
  const textColor = selected ? theme.colors.onPrimary : theme.colors.text

  return (
    <Pressable onPress={onPress} style={[s.base, { backgroundColor: bgColor }]}>
      {icon}
      <Text size={14} weight="medium" color={textColor}>{label}</Text>
    </Pressable>
  )
}
