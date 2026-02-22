import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Card, Divider, Header } from '@/components/ui'
import { useSettingsStore } from '@/stores/settings.store'
import { Check } from 'lucide-react-native'

type Theme = 'light' | 'dark' | 'system'

const THEME_OPTIONS: Array<{ value: Theme; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
  { value: 'system', label: 'System', description: 'Follow device settings' },
]

export default function SettingsScreen() {
  const { theme } = useUnistyles()
  const { theme: currentTheme, setTheme } = useSettingsStore()

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Settings" showBack />
      <Spacer size={spacing.lg} />

      {/* Theme */}
      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        APPEARANCE
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        {THEME_OPTIONS.map((opt, index) => {
          const selected = currentTheme === opt.value
          return (
            <View key={opt.value}>
              {index > 0 && <Divider spacing={0} />}
              <Pressable
                onPress={() => setTheme(opt.value)}
                style={({ pressed }) => [
                  s.row,
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <View style={s.rowLeft}>
                  <Text weight="medium">{opt.label}</Text>
                  <Text variant="caption" color={theme.colors.textSub}>{opt.description}</Text>
                </View>
                {selected && (
                  <Check size={20} color={theme.colors.primary} />
                )}
              </Pressable>
            </View>
          )
        })}
      </Card>

      <Spacer size={spacing.lg} />

      {/* Currency */}
      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        CURRENCY
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        <Pressable style={s.row}>
          <View style={s.rowLeft}>
            <Text weight="medium">Nigerian Naira (NGN)</Text>
            <Text variant="caption" color={theme.colors.textSub}>₦ — default display currency</Text>
          </View>
          <Check size={20} color={theme.colors.primary} />
        </Pressable>
      </Card>

      <Spacer size={spacing.lg} />

      {/* App info */}
      <Text variant="caption" color={theme.colors.textFaint} align="center">
        Tenda v1.0.0
      </Text>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    paddingHorizontal: 4,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
})
