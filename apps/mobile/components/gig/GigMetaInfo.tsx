import { View, StyleSheet } from 'react-native'
import { MapPin, Clock, Calendar, ArrowLeftRight, Globe } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { formatDuration, formatDeadline } from '@/lib/gig-display'
import { formatFiat } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { LOCATIONS, ASSET_META, amountRawToDisplay } from '@tenda/shared'
import type { GigDetail, CountryCode, SupportedCurrency } from '@tenda/shared'
import type { LucideIcon } from 'lucide-react-native'

interface Props {
  gig: Pick<
    GigDetail,
    | 'city' | 'country' | 'remote'
    | 'completion_duration_seconds' | 'accept_deadline'
    | 'cross_border' | 'amount_raw' | 'asset' | 'status'
  >
  posterCountry: string | null
  deadlineLbl: string | null
}

interface Row {
  Icon: LucideIcon
  label: string
  value: string
  iconTint?: string
}

export function GigMetaInfo({ gig, posterCountry, deadlineLbl }: Props) {
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency) as SupportedCurrency
  const rate = rates?.[currency] ?? null

  const assetMeta = ASSET_META[gig.asset]
  const amount = amountRawToDisplay(gig.amount_raw, gig.asset)
  const symbol = assetMeta?.symbol ?? gig.asset

  // The platform rate cache is SOL-denominated — a fiat equivalent is only
  // meaningful for native-SOL gigs. Stable assets read as ≈ face value.
  const isSolAsset = symbol === 'SOL'
  const fiatAlt =
    isSolAsset && rate !== null && rate > 0 ? `≈ ${formatFiat(amount * rate, currency)}` : null

  // Escrow is funded once the gig leaves draft (the create tx confirming is
  // what flips draft → open).
  const escrowFunded = gig.status !== 'draft'

  const rows: Row[] = []

  if (gig.completion_duration_seconds !== null) {
    rows.push({
      Icon: Calendar,
      label: 'Deliver within',
      value: formatDuration(gig.completion_duration_seconds),
    })
  }

  rows.push({
    Icon: gig.remote ? Globe : MapPin,
    label: 'Location',
    value: gig.remote
      ? `Remote · ${LOCATIONS[gig.country as CountryCode]?.name ?? gig.country}`
      : (gig.city ?? '—'),
    iconTint: gig.remote ? theme.colors.brand.primary : undefined,
  })

  if (gig.cross_border) {
    rows.push({
      Icon: ArrowLeftRight,
      label: 'Cross-border',
      value: posterCountry
        ? `Posted from ${LOCATIONS[posterCountry as CountryCode]?.name ?? posterCountry}`
        : 'Yes',
    })
  }

  if (gig.accept_deadline) {
    rows.push({
      Icon: Clock,
      label: 'Accept by',
      value: formatDeadline(gig.accept_deadline),
    })
  }

  if (deadlineLbl) {
    rows.push({
      Icon: Clock,
      label: 'Deadline',
      value: deadlineLbl,
    })
  }

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      {/* Payment header */}
      <View style={s.top}>
        <View style={s.payCol}>
          <Text style={[s.payLabel, { color: theme.colors.content.tertiary }]}>
            PAYMENT
          </Text>
          <View style={s.payValue}>
            <Text style={[s.payAmount, { color: theme.colors.content.primary }]}>
              {amount.toLocaleString('en-US', { maximumFractionDigits: amount >= 1 ? 2 : 4 })}
            </Text>
            <Text style={[s.payUnit, { color: theme.colors.content.secondary }]}>
              {symbol}
            </Text>
          </View>
          {fiatAlt && (
            <Text style={[s.payFiat, { color: theme.colors.content.tertiary }]}>
              {fiatAlt}
            </Text>
          )}
        </View>

        {escrowFunded && (
          <View style={[s.escrow, { backgroundColor: theme.colors.feedback.success.surface }]}>
            <View style={[s.escrowDot, { backgroundColor: theme.colors.feedback.success.base }]} />
            <Text style={[s.escrowLabel, { color: theme.colors.feedback.success.base }]}>
              ESCROW READY
            </Text>
          </View>
        )}
      </View>

      <View style={[s.divider, { backgroundColor: theme.colors.border.subtle }]} />

      {/* Meta rows */}
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1
        return (
          <View
            key={`${row.label}-${i}`}
            style={[
              s.row,
              !isLast && {
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.subtle,
              },
            ]}
          >
            <View style={s.iconWrap}>
              <row.Icon size={14} color={row.iconTint ?? theme.colors.content.tertiary} />
            </View>
            <Text style={[s.rowLabel, { color: theme.colors.content.secondary }]} numberOfLines={1}>
              {row.label}
            </Text>
            <Text
              style={[s.rowValue, { color: theme.colors.content.primary }]}
              numberOfLines={1}
            >
              {row.value}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  top: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  payCol: {
    flex: 1,
    minWidth: 0,
  },
  payLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 1.0,
  },
  payValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  payAmount: {
    fontFamily: typography.fonts.mono,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.22,
  },
  payUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  payFiat: {
    fontFamily: typography.fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  escrow: {
    flexShrink: 0,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  escrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  escrowLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.05,
  },
  divider: {
    height: 1,
  },
  row: {
    height: 40,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconWrap: {
    width: 16,
    alignItems: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  rowValue: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.135,
    textAlign: 'right',
    flexShrink: 1,
  },
})
