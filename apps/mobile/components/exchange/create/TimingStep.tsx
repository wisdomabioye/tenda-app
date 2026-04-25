import { useState } from 'react'
import { View, Pressable, Platform, StyleSheet } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { CalendarDays } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'

const WINDOW_OPTIONS = [
  { label: '1h',  value: 3_600 },
  { label: '2h',  value: 7_200 },
  { label: '6h',  value: 21_600 },
  { label: '12h', value: 43_200 },
  { label: '24h', value: 86_400 },
  { label: '48h', value: 172_800 },
]

const TOMORROW = new Date(Date.now() + 86_400_000)

interface Props {
  windowSeconds:  number
  hasDeadline:    boolean
  deadlineInput:  string
  onWindow:       (s: number) => void
  onHasDeadline:  (v: boolean) => void
  onDeadline:     (v: string) => void
}

export function TimingStep({
  windowSeconds, hasDeadline, deadlineInput,
  onWindow, onHasDeadline, onDeadline,
}: Props) {
  const { theme } = useUnistyles()
  const [showPicker, setShowPicker] = useState(false)

  const selectedDate = deadlineInput ? new Date(deadlineInput) : TOMORROW

  function handleDateChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowPicker(false)
    if (date) onDeadline(date.toISOString())
  }

  const formattedDate = deadlineInput
    ? selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Tap to select'

  return (
    <View style={s.wrap}>
      <SectionLabel>Payment window</SectionLabel>
      <Text style={[s.hint, { color: theme.colors.content.tertiary }]}>
        How long the buyer has to send payment after accepting.
      </Text>
      <View style={s.chipRow}>
        {WINDOW_OPTIONS.map(({ label, value }) => (
          <Chip
            key={value}
            label={label}
            variant="form"
            selected={windowSeconds === value}
            onPress={() => onWindow(value)}
          />
        ))}
      </View>

      <SectionLabel>Accept deadline</SectionLabel>
      <Text style={[s.hint, { color: theme.colors.content.tertiary }]}>
        Offer expires automatically after this date (optional).
      </Text>
      <View style={s.chipRow}>
        <Chip
          label="No deadline"
          variant="form"
          selected={!hasDeadline}
          onPress={() => onHasDeadline(false)}
        />
        <Chip
          label="Set deadline"
          variant="form"
          selected={hasDeadline}
          onPress={() => onHasDeadline(true)}
        />
      </View>

      {hasDeadline && (
        <Pressable
          onPress={() => setShowPicker(true)}
          style={({ pressed }) => [
            s.dateRow,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: theme.colors.border.default,
            },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
        >
          <CalendarDays size={16} color={theme.colors.content.secondary} />
          <Text
            style={s.dateText}
            color={deadlineInput ? theme.colors.content.primary : theme.colors.content.tertiary}
          >
            {formattedDate}
          </Text>
        </Pressable>
      )}

      {hasDeadline && (showPicker || Platform.OS === 'ios') && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={TOMORROW}
          onChange={handleDateChange}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
  },
  hint: {
    fontSize: 12.5,
    lineHeight: 17,
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginTop: -4,
  },
  chipRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateRow: {
    marginHorizontal: 20,
    marginTop: 10,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
  },
})
