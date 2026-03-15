import { View, StyleSheet, TextInput } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text, Button, Spacer, Card } from '@/components/ui'
import { EXCHANGE_DISPUTE_REASON_MIN_LENGTH } from '@tenda/shared'

interface Props {
  value:    string
  onChange: (v: string) => void
  loading:  boolean
  onSubmit: () => void
  onCancel: () => void
}

export function DisputeSheet({ value, onChange, loading, onSubmit, onCancel }: Props) {
  const { theme } = useUnistyles()
  const remaining = EXCHANGE_DISPUTE_REASON_MIN_LENGTH - value.trim().length
  const canSubmit = remaining <= 0
  return (
    <Card variant="outlined" padding={spacing.md} style={[s.card, { borderColor: theme.colors.warning }]}>
      <Text weight="semibold">Describe the Issue</Text>
      <Spacer size={spacing.sm} />
      <TextInput
        style={[s.input, {
          color: theme.colors.text,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }]}
        placeholder="What went wrong? Be specific…"
        placeholderTextColor={theme.colors.textFaint}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={4}
      />
      {value.trim().length > 0 && !canSubmit && (
        <Text variant="caption" color={theme.colors.textFaint} style={{ marginTop: 4 }}>
          {remaining} more character{remaining !== 1 ? 's' : ''} needed
        </Text>
      )}
      <Spacer size={spacing.sm} />
      <View style={s.row}>
        <Button variant="ghost"  style={s.flex1} onPress={onCancel}>Cancel</Button>
        <Button variant="danger" style={s.flex2} loading={loading} disabled={!canSubmit} onPress={onSubmit}>Submit Dispute</Button>
      </View>
    </Card>
  )
}

const s = StyleSheet.create({
  card:  { marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 100,
    textAlignVertical: 'top', fontSize: typography.sizes.sm,
  },
  row:   { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
})
