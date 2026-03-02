import { useState } from 'react'
import { View, Pressable, TextInput, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: '1d',  seconds: 86_400 },
  { label: '3d',  seconds: 259_200 },
  { label: '7d',  seconds: 604_800 },
  { label: '14d', seconds: 1_209_600 },
  { label: '30d', seconds: 2_592_000 },
]

interface DurationPickerProps {
  label?: string
  helper?: string
  value: number
  onChange: (seconds: number) => void
}

export function DurationPicker({
  label = 'Completion window',
  helper = 'How long the worker has after accepting',
  value,
  onChange,
}: DurationPickerProps) {
  const { theme } = useUnistyles()

  const isPreset = PRESETS.some((p) => p.seconds === value)
  const [customMode, setCustomMode] = useState(!isPreset)
  const [customNum, setCustomNum] = useState(isPreset ? '' : String(Math.round(value / 86_400)))
  const [unit, setUnit] = useState<'hours' | 'days'>('days')

  function selectPreset(seconds: number) {
    setCustomMode(false)
    onChange(seconds)
  }

  function handleCustomChange(val: string) {
    setCustomNum(val)
    const n = parseInt(val, 10)
    if (n > 0) onChange(n * (unit === 'days' ? 86_400 : 3_600))
  }

  function toggleUnit() {
    const next = unit === 'days' ? 'hours' : 'days'
    setUnit(next)
    const n = parseInt(customNum, 10)
    if (n > 0) onChange(n * (next === 'days' ? 86_400 : 3_600))
  }

  return (
    <View style={s.container}>
      <Text variant="label">{label}</Text>
      <Text variant="caption" color={theme.colors.textFaint}>{helper}</Text>

      <View style={s.row}>
        {PRESETS.map((p) => {
          const selected = !customMode && value === p.seconds
          return (
            <Pressable
              key={p.seconds}
              onPress={() => selectPreset(p.seconds)}
              style={[s.chip, { backgroundColor: selected ? theme.colors.primary : theme.colors.muted }]}
            >
              <Text size={13} weight="semibold" color={selected ? theme.colors.onPrimary : theme.colors.text}>
                {p.label}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={() => setCustomMode(true)}
          style={[s.chip, { backgroundColor: customMode ? theme.colors.primary : theme.colors.muted }]}
        >
          <Text size={13} weight="semibold" color={customMode ? theme.colors.onPrimary : theme.colors.text}>
            Custom
          </Text>
        </Pressable>
      </View>

      {customMode && (
        <View style={s.customRow}>
          <TextInput
            value={customNum}
            onChangeText={handleCustomChange}
            keyboardType="numeric"
            placeholder="e.g. 10"
            placeholderTextColor={theme.colors.textFaint}
            style={[s.customInput, { backgroundColor: theme.colors.input, color: theme.colors.text }]}
          />
          <Pressable onPress={toggleUnit} style={[s.unitBtn, { backgroundColor: theme.colors.muted }]}>
            <Text size={13} weight="semibold" color={theme.colors.primary}>{unit}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  unitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
})
