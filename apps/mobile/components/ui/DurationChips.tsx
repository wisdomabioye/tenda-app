import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'
import { Chip } from './Chip'
import { SectionLabel } from './SectionLabel'

export interface DurationOption {
  label: string
  /** Unit is the caller's choice (hours for gigs, seconds for exchange). */
  value: number
}

/**
 * A labelled row of single-select duration chips. The one picker shared by the
 * gig accept-deadline and the exchange offer windows — the unit lives with the
 * caller's option set, so this stays purely presentational.
 */
export function DurationChips({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: readonly DurationOption[]
  value: number
  onChange: (value: number) => void
}) {
  const { theme } = useUnistyles()
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      {hint !== undefined && (
        <Text style={[s.hint, { color: theme.colors.content.tertiary }]}>{hint}</Text>
      )}
      <View style={s.chipRow}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            variant="form"
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </View>
    </>
  )
}

const s = StyleSheet.create({
  hint: { fontSize: 12.5, lineHeight: 17, paddingHorizontal: 20, paddingBottom: 8, marginTop: -4 },
  chipRow: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
