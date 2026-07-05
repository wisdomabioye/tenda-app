import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ChevronRight } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { ExchangeStatusBadge } from './ExchangeStatusBadge'
import { formatFiat } from '@/lib/currency'
import { formatAssetAmount, ASSET_META } from '@tenda/shared'
import type { ExchangeSummary, SupportedCurrency } from '@tenda/shared'

interface Props {
  offer: ExchangeSummary
  showStatus?: boolean
}

export function ExchangeOfferCard({ offer, showStatus = false }: Props) {
  const router = useRouter()
  const { theme } = useUnistyles()

  // numeric(20,4)/(30,10) arrive as strings, display-only conversion.
  const fiat = formatFiat(Number(offer.fiat_amount), offer.fiat_currency as SupportedCurrency)
  const rate = formatFiat(Number(offer.rate), offer.fiat_currency as SupportedCurrency)
  const symbol = ASSET_META[offer.asset]?.symbol ?? offer.asset
  const sellerName =
    `${offer.creator.first_name ?? ''} ${offer.creator.last_name ?? ''}`.trim() || 'Seller'
  const handle = offer.creator.first_name ? `@${offer.creator.first_name.toLowerCase()}` : null
  // numeric(3,2), string on the wire, null when unrated.
  const score = offer.creator.review_score === null ? null : Number(offer.creator.review_score)

  return (
    <Pressable
      onPress={() => router.push(`/exchange/${offer.escrow_id}`)}
      style={({ pressed }) => [
        s.row,
        { borderBottomColor: theme.colors.border.subtle },
        pressed && s.pressed,
      ]}
    >
      <Avatar src={offer.creator.avatar_url} name={sellerName} size="md" />

      <View style={s.body}>
        {/* Row 1, asset → fiat */}
        <View style={s.row1}>
          <Text style={[s.sol, { color: theme.colors.content.primary }]} numberOfLines={1}>
            {formatAssetAmount(offer.amount_raw, offer.asset)}
          </Text>
          <Text style={[s.arrow, { color: theme.colors.content.tertiary }]}>→</Text>
          <Text style={[s.fiat, { color: theme.colors.content.primary }]} numberOfLines={1}>
            {fiat}
          </Text>
        </View>

        {/* Row 2, handle · ★ rating · rate/asset */}
        <View style={s.row2}>
          {handle && (
            <Text style={[s.metaText, { color: theme.colors.content.tertiary }]}>{handle}</Text>
          )}
          {score != null && handle && (
            <Text style={[s.metaSep, { color: theme.colors.content.tertiary }]}>·</Text>
          )}
          {score != null && (
            <Text style={[s.metaText, { color: theme.colors.content.tertiary }]}>
              <Text style={{ color: theme.colors.accent.primary }}>★ </Text>
              {score.toFixed(1)}
            </Text>
          )}
          <Text style={[s.metaSep, { color: theme.colors.content.tertiary }]}>·</Text>
          <Text style={[s.metaText, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
            {rate}/{symbol}
          </Text>
        </View>

        {/* Row 3, offer status (My Offers variant) */}
        {showStatus && (
          <View style={s.row3}>
            <ExchangeStatusBadge status={offer.status} />
          </View>
        )}
      </View>

      <ChevronRight size={20} color={theme.colors.content.tertiary} style={s.chev} />
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  pressed: { opacity: 0.96 },
  body: {
    flex: 1,
    minWidth: 0,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  sol: {
    fontFamily: typography.fonts.mono,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.16,
    flexShrink: 0,
  },
  arrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 0,
  },
  fiat: {
    fontFamily: typography.fonts.mono,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  metaSep: {
    fontSize: 12.5,
    lineHeight: 16,
    opacity: 0.5,
  },
  row3: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chev: {
    alignSelf: 'center',
  },
})
