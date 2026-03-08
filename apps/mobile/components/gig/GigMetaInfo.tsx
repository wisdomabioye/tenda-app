import { View, StyleSheet } from 'react-native'
import { MapPin, Clock, Calendar } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { formatDuration, formatDeadline } from '@/lib/gig-display'
import type { GigDetail } from '@tenda/shared'

interface Props {
  gig: Pick<GigDetail, 'address' | 'city' | 'completion_duration_seconds' | 'accept_deadline'>
  deadlineLbl: string | null
}

export function GigMetaInfo({ gig, deadlineLbl }: Props) {
  const { theme } = useUnistyles()

  return (
    <View style={s.grid}>
      <View style={s.item}>
        <MapPin size={16} color={theme.colors.textFaint} />
        <Text variant="body" color={theme.colors.textSub}>{gig.address ?? gig.city}</Text>
      </View>
      {deadlineLbl ? (
        <View style={s.item}>
          <Clock size={16} color={theme.colors.textFaint} />
          <Text variant="body" color={theme.colors.textSub}>{deadlineLbl}</Text>
        </View>
      ) : null}
      <View style={s.item}>
        <Calendar size={16} color={theme.colors.textFaint} />
        <Text variant="body" color={theme.colors.textSub}>
          {`${formatDuration(gig.completion_duration_seconds)} to complete after acceptance`}
        </Text>
      </View>
      {gig.accept_deadline && (
        <View style={s.item}>
          <Clock size={16} color={theme.colors.textFaint} />
          <Text variant="body" color={theme.colors.textSub}>
            Accept by {formatDeadline(gig.accept_deadline)}
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grid: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
