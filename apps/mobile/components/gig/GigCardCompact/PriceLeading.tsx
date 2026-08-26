import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Clock, Check, ArrowLeftRight } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { CATEGORY_META, toAssetPaymentDisplay, formatFiat, LOCATIONS, type CountryCode, GigSummary, gigDeadlineMeta } from '@tenda/shared'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { ChainBadge } from '@/components/escrow/ChainBadge'
import { STATUS_DOT_COLOR, STATUS_LABEL } from './shared'

interface Props {
  gig: GigSummary
  showStatus?: boolean
}

/**
 * Variant A, Price-Leading (home.html `.card` proposal).
 * Two-column grid 86 / 1fr. Left strip carries the amount, its symbol and the
 * fiat alt, stacked; right body carries category/status label, the settlement
 * chain, deadline chip, title, and location meta.
 *
 * The chain sits on the category row rather than under the money because which
 * chain a gig pays on decides whether the reader holds a wallet that can take
 * it — the same reason it reads beside the category on web.
 */
export function GigCardCompactPriceLeading({ gig, showStatus = false }: Props) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)

  const categoryColor = theme.colors.category[gig.category]
  const categoryLabel =
    CATEGORY_META.find((c) => c.key === gig.category)?.label ?? gig.category
  const price = toAssetPaymentDisplay(gig.amount_raw, gig.asset, rates, currency)

  const deadlineMeta = gigDeadlineMeta(gig)
  const isUrgent = deadlineMeta.tone === 'urgent'
  const isSuccess = deadlineMeta.tone === 'success'

  const statusDotColor = STATUS_DOT_COLOR(theme, gig.status)
  const fiatAlt = price.fiat !== null ? `≈ ${formatFiat(price.fiat, currency)}` : ''
  const flag = LOCATIONS[gig.country as CountryCode]?.flag ?? ''
  const locationLabel = gig.remote ? `Remote${flag ? ` · ${flag}` : ''}` : gig.city ?? ''

  return (
    <Pressable
      onPress={() => router.push(`/gig/${gig.escrow_id}`)}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: theme.colors.border.default,
        },
        pressed && s.pressed,
      ]}
    >
      <View
        style={[
          s.priceStrip,
          {
            backgroundColor: theme.colors.surface.backgroundAlt,
            borderRightColor: theme.colors.border.subtle,
          },
        ]}
      >
        <Text style={[s.paysLabel, { color: theme.colors.content.tertiary }]}>
          PAYS
        </Text>
        <View style={s.priceBlock}>
          <Text
            style={[s.amount, { color: theme.colors.content.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {price.amount.toFixed(price.amount >= 1 ? 2 : 3)}
          </Text>
          <Text style={[s.unit, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
            {price.symbol}
          </Text>
          {fiatAlt ? (
            <Text style={[s.fiat, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
              {fiatAlt}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={s.body}>
        <View style={s.topRow}>
          <View style={s.label}>
            <View
              style={[
                s.dot,
                { backgroundColor: showStatus ? statusDotColor : categoryColor.base },
              ]}
            />
            <Text
              style={[s.labelText, { color: theme.colors.content.secondary }]}
              numberOfLines={1}
            >
              {showStatus ? STATUS_LABEL[gig.status] : categoryLabel}
            </Text>
          </View>

          <View style={s.rowBadges}>
            <ChainBadge chainId={gig.chain_id} />
            {deadlineMeta.label ? (
              <View
                style={[
                  s.deadlineChip,
                  {
                    backgroundColor: isUrgent
                      ? theme.colors.feedback.warning.surface
                      : isSuccess
                        ? theme.colors.feedback.success.surface
                        : theme.colors.surface.inset,
                  },
                ]}
              >
                {deadlineMeta.glyph === 'check' ? (
                  <Check size={10} color={theme.colors.feedback.success.base} strokeWidth={3} />
                ) : deadlineMeta.glyph === 'clock' ? (
                  <Clock
                    size={10}
                    color={
                      isUrgent
                        ? theme.colors.feedback.warning.base
                        : theme.colors.content.secondary
                    }
                  />
                ) : null}
                <Text
                  style={[
                    s.deadlineText,
                    {
                      color: isUrgent
                        ? theme.colors.feedback.warning.base
                        : isSuccess
                          ? theme.colors.feedback.success.base
                          : theme.colors.content.secondary,
                      fontWeight: isUrgent || isSuccess ? '600' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {deadlineMeta.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text
          style={[s.title, { color: theme.colors.content.primary }]}
          numberOfLines={1}
        >
          {gig.title}
        </Text>

        <View style={s.meta}>
          {locationLabel ? (
            <Text
              style={[s.metaText, { color: theme.colors.content.tertiary }]}
              numberOfLines={1}
            >
              {locationLabel}
            </Text>
          ) : null}
          {gig.cross_border && (
            <>
              {locationLabel ? (
                <Text style={[s.metaSep, { color: theme.colors.content.tertiary }]}>·</Text>
              ) : null}
              <ArrowLeftRight size={11} color={theme.colors.feedback.warning.base} />
              <Text
                style={[s.metaText, { color: theme.colors.feedback.warning.base }]}
                numberOfLines={1}
              >
                Cross-border
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 112,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.995 }] },
  priceStrip: {
    width: 86,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paysLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
  },
  // `alignSelf: 'stretch'` is the load-bearing rule, not tidiness. `priceStrip`
  // is a column with `alignItems: 'flex-start'`, so without it this block is
  // sized to its own max-content width and simply paints past the 86px strip —
  // `numberOfLines` and font auto-sizing have no box to fit INTO. Stretching
  // hands it the strip's real content width (86 - 2x10 = 66px), which is what
  // both rules below measure against.
  priceBlock: { alignSelf: 'stretch' },
  amount: {
    fontFamily: typography.fonts.mono,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  // The symbol sits UNDER the digits rather than beside them. Measured: 66px
  // holds neither pair — '50.00 USDC' wants ~78px and '1462.00 USDC' ~99px —
  // so side-by-side elided the asset on ordinary gigs, not just large ones.
  // Stacked, the digits get all 66px, which covers every amount up to five
  // characters at full size; longer ones lose a little type size (see
  // `adjustsFontSizeToFit` above) and the symbol always stays whole.
  unit: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  fiat: {
    fontFamily: typography.fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.105,
    marginTop: 4,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'column',
    gap: 6,
  },
  // `flexWrap` is load-bearing since the chain joined this row, and the width
  // is MEASURED: at a 320px device the list pads 16, the price strip takes a
  // fixed 86 and the body pads 14, leaving this row 174px — where the label,
  // the chain and the deadline together want ~245px. They do not fit, and
  // without the wrap the category squeezed away. Wrapping drops the badge pair
  // onto its own right-aligned line and every label stays whole. `minHeight`
  // rather than the old fixed `height: 22`, or the second line has nowhere to
  // go. Testnet chain names are the long ones ('Solana Devnet'); production
  // reads 'Solana', 'BASE'.
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 6,
    minHeight: 22,
  },
  // Chain and deadline move as one unit so the wrap never splits them across
  // two lines, and `marginLeft: 'auto'` right-aligns the pair on whichever
  // line it lands on.
  rowBadges: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  labelText: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    flexShrink: 0,
  },
  deadlineText: { fontSize: 11, lineHeight: 14, letterSpacing: -0.11 },
  title: { fontSize: 15, lineHeight: 19.5, fontWeight: '600', letterSpacing: -0.15 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12.5, lineHeight: 16, flexShrink: 1 },
  metaSep: { fontSize: 12.5, lineHeight: 16, opacity: 0.5 },
})
