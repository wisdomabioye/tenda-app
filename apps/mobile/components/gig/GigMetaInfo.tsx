import { View, StyleSheet } from 'react-native'
import { MapPin, Clock, Calendar, ArrowLeftRight, Globe } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { formatDuration, formatDeadline } from '@/lib/gig-display'
import { LOCATIONS } from '@tenda/shared'
import type { GigDetail, CountryCode } from '@tenda/shared'

interface Props {
  gig: Pick<GigDetail, 'address' | 'city' | 'country' | 'remote' | 'completion_duration_seconds' | 'accept_deadline' | 'cross_border'>
  posterCountry: string | null
  deadlineLbl: string | null
}

export function GigMetaInfo({ gig, posterCountry, deadlineLbl }: Props) {
  const { theme } = useUnistyles()

  return (
    <View style={s.grid}>
      <View style={s.item}>
        {gig.remote
          ? <Globe size={16} color={theme.colors.brand.primary} />
          : <MapPin size={16} color={theme.colors.content.tertiary} />}
        <Text variant="body" color={gig.remote ? theme.colors.brand.primary : theme.colors.content.secondary}>
          {gig.remote
            ? `Remote · ${LOCATIONS[gig.country as CountryCode]?.name ?? gig.country}`
            : (gig.address ?? gig.city)}
        </Text>
      </View>
      {gig.cross_border && (
        <View style={s.item}>
          <ArrowLeftRight size={16} color={theme.colors.content.tertiary} />
          <Text variant="body" color={theme.colors.content.secondary}>
            {posterCountry
              ? `Posted from ${LOCATIONS[posterCountry as CountryCode]?.name ?? posterCountry}`
              : 'Cross-border'}
          </Text>
        </View>
      )}
      {deadlineLbl ? (
        <View style={s.item}>
          <Clock size={16} color={theme.colors.content.tertiary} />
          <Text variant="body" color={theme.colors.content.secondary}>{deadlineLbl}</Text>
        </View>
      ) : null}
      <View style={s.item}>
        <Calendar size={16} color={theme.colors.content.tertiary} />
        <Text variant="body" color={theme.colors.content.secondary}>
          {`${formatDuration(gig.completion_duration_seconds)} to complete after acceptance`}
        </Text>
      </View>
      {gig.accept_deadline && (
        <View style={s.item}>
          <Clock size={16} color={theme.colors.content.tertiary} />
          <Text variant="body" color={theme.colors.content.secondary}>
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
