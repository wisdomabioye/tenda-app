import { Text } from './Text'
import { useUnistyles } from 'react-native-unistyles'
import { StyleSheet } from 'react-native'
import { typography } from '@/theme/tokens'

interface SectionLabelProps {
  children: string
  /** When `true`, paddingTop is reduced (for sections that follow another section without a gap) */
  tight?: boolean
}

/**
 * Mono uppercase eyebrow used between form / detail sections.
 * Per wireframe `.sec-label`: mono 9.5/600 +0.10em uppercase --ink-3, padding 18 20 8.
 */
export function SectionLabel({ children, tight = false }: SectionLabelProps) {
  const { theme } = useUnistyles()
  return (
    <Text
      style={[
        s.label,
        { color: theme.colors.content.tertiary, paddingTop: tight ? 12 : 18 },
      ]}
    >
      {children.toUpperCase()}
    </Text>
  )
}

const s = StyleSheet.create({
  label: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    paddingHorizontal: 20,
    paddingBottom: 8,
    includeFontPadding: false,
  },
})
