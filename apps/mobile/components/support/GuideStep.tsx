import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { AlertTriangle, Info } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { typography } from '@/theme/tokens'
import { Text, Spacer } from '@/components/ui'

interface GuideStepProps {
  step: number
  title: string
  description?: string
  warning?: string
  tip?: string
}

export function GuideStep({ step, title, description, warning, tip }: GuideStepProps) {
  const { theme } = useUnistyles()

  return (
    <View style={s.container}>
      <View style={[s.stepBadge, { backgroundColor: theme.colors.brand.primarySurface }]}>
        <Text size={typography.styles.caption.fontSize} weight="bold" color={theme.colors.brand.primary}>
          {step}
        </Text>
      </View>

      <View style={s.content}>
        <Text variant="label" weight="semibold">{title}</Text>

        {description && (
          <>
            <Spacer size={2} />
            <Text variant="caption" color={theme.colors.content.secondary}>{description}</Text>
          </>
        )}

        {warning && (
          <>
            <Spacer size={spacing.xs} />
            <View style={[s.callout, { backgroundColor: theme.colors.feedback.warning.surface }]}>
              <AlertTriangle size={12} color={theme.colors.feedback.warning.text} />
              <Text variant="caption" color={theme.colors.feedback.warning.text} style={s.calloutText}>
                {warning}
              </Text>
            </View>
          </>
        )}

        {tip && (
          <>
            <Spacer size={spacing.xs} />
            <View style={[s.callout, { backgroundColor: theme.colors.feedback.info.surface }]}>
              <Info size={12} color={theme.colors.feedback.info.text} />
              <Text variant="caption" color={theme.colors.feedback.info.text} style={s.calloutText}>
                {tip}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  calloutText: {
    flex: 1,
  },
})
