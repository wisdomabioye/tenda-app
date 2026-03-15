import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Text, Button, Spacer, Card } from '@/components/ui'
import { FilePicker, type PickedFile } from '@/components/form/FilePicker'
import { formatFiat } from '@/lib/currency'
import type { SupportedCurrency } from '@tenda/shared'

interface Props {
  fiatAmount:  number
  currency:    SupportedCurrency
  files:       PickedFile[]
  onFiles:     (f: PickedFile[]) => void
  loading:     boolean
  onSubmit:    () => void | Promise<void>
  onCancel:    () => void
}

export function PaidProofSheet({ fiatAmount, currency, files, onFiles, loading, onSubmit, onCancel }: Props) {
  return (
    <Card variant="outlined" padding={spacing.md} style={s.card}>
      <Text weight="semibold">Proof of Payment</Text>
      <Text variant="caption" style={{ marginTop: 4 }}>
        Screenshot or receipt showing you sent {formatFiat(fiatAmount, currency)}
      </Text>
      <Spacer size={spacing.sm} />
      <FilePicker files={files} onChange={onFiles} accept="image" max={5} />
      <Spacer size={spacing.sm} />
      <View style={s.row}>
        <Button variant="ghost" style={s.flex1} onPress={onCancel}>Cancel</Button>
        <Button variant="primary" style={s.flex2} loading={loading} disabled={files.length === 0} onPress={onSubmit}>Submit Proof</Button>
      </View>
    </Card>
  )
}

const s = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row:  { flexDirection: 'row', gap: spacing.sm },
  flex1:{ flex: 1 },
  flex2:{ flex: 2 },
})
