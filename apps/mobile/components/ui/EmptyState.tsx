import { type ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Text } from './Text'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onPress: () => void
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  icon: { marginBottom: spacing.sm },
  description: { marginTop: 2 },
  action: { marginTop: spacing.md },
})

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={s.container}>
      {icon && <View style={s.icon}>{icon}</View>}
      <Text variant="subheading" align="center">{title}</Text>
      {description && (
        <Text variant="caption" align="center" style={s.description}>{description}</Text>
      )}
      {action && (
        <Button variant="primary" size="md" onPress={action.onPress} style={s.action}>
          {action.label}
        </Button>
      )}
    </View>
  )
}
