import { useState } from 'react'
import { View, Pressable, Platform, StyleSheet } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { CalendarDays } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Text, Spacer } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'

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
  const { theme }          = useUnistyles()
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
      <Text variant="subheading">Payment window</Text>
      <Text variant="caption" style={{ marginTop: 4 }}>
        How long the buyer has to send payment after accepting
      </Text>
      <Spacer size={spacing.md} />
      <View style={s.chips}>
        {WINDOW_OPTIONS.map(({ label, value }) => (
          <Chip key={value} label={label} selected={windowSeconds === value} onPress={() => onWindow(value)} />
        ))}
      </View>

      <Spacer size={spacing.lg} />
      <Text variant="subheading">Accept deadline</Text>
      <Text variant="caption" style={{ marginTop: 4 }}>
        Offer expires automatically after this date (optional)
      </Text>
      <Spacer size={spacing.sm} />
      <View style={s.chips}>
        <Chip label="No deadline" selected={!hasDeadline} onPress={() => onHasDeadline(false)} />
        <Chip label="Set deadline" selected={hasDeadline}  onPress={() => onHasDeadline(true)} />
      </View>

      {hasDeadline && (
        <>
          <Spacer size={spacing.sm} />
          <Pressable
            style={[s.dateRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            onPress={() => setShowPicker(true)}
          >
            <CalendarDays size={18} color={theme.colors.textSub} />
            <Text style={s.dateText} color={deadlineInput ? theme.colors.text : theme.colors.textSub}>
              {formattedDate}
            </Text>
          </Pressable>

          {(showPicker || Platform.OS === 'ios') && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={TOMORROW}
              onChange={handleDateChange}
            />
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap:     { paddingHorizontal: spacing.md },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dateRow:  {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  dateText: { flex: 1 },
})
