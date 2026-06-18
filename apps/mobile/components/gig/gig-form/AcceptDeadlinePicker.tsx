import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ACCEPT_DEADLINE_OPTIONS } from './constants'

/** How long the gig stays open for workers to accept (drives the refund window). */
export function AcceptDeadlinePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (hours: number) => void
}) {
  const { theme } = useUnistyles()
  return (
    <>
      <SectionLabel>Accept deadline</SectionLabel>
      <Text style={[s.hint, { color: theme.colors.content.tertiary }]}>
        How long the gig stays open for workers to accept.
      </Text>
      <View style={s.chipRow}>
        {ACCEPT_DEADLINE_OPTIONS.map((opt) => (
          <Chip
            key={String(opt.hours)}
            label={opt.label}
            variant="form"
            selected={value === opt.hours}
            onPress={() => onChange(opt.hours)}
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
