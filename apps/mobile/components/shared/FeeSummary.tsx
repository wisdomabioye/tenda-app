import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { computePlatformFee, formatAssetAmount } from '@tenda/shared'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useIsSeeker } from '@/stores/auth.store'
import { usePlatformConfigStore } from '@/stores/platform-config.store'

interface FeeSummaryProps {
  /** Asset registry id, drives decimals + symbol (CO5). */
  asset: string
  /** Principal in raw units of `asset` — the budget the poster escrows. */
  principalRaw: number
  /** Optional eyebrow override; defaults to "PAYMENT BREAKDOWN" */
  eyebrow?: string
}

/**
 * Platform-fee breakdown card for the create-gig review step. The poster
 * escrows exactly the budget; the platform fee is deducted from the worker's
 * payout on settlement (see the contract's `approve`: payout = amount − fee).
 * So this shows: You escrow (budget) / Platform fee / Worker receives (net) —
 * never budget + fee, which would misrepresent the fee as the poster's.
 */
export function FeeSummary({
  asset,
  principalRaw,
  eyebrow = 'PAYMENT BREAKDOWN',
}: FeeSummaryProps) {
  const { theme } = useUnistyles()
  const isSeeker = useIsSeeker()
  const config = usePlatformConfigStore((s) => s.config)
  const fetchConfig = usePlatformConfigStore((s) => s.fetch)

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const feeBps = config != null
    ? (isSeeker ? config.seeker_fee_bps : config.fee_bps)
    : null

  const feeRaw = feeBps != null
    ? Number(computePlatformFee(BigInt(principalRaw), feeBps))
    : null
  const workerReceivesRaw = feeRaw != null ? principalRaw - feeRaw : null
  const feePct = feeBps != null ? (feeBps / 100).toFixed(2) : '—'

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
      <Eyebrow style={s.eyebrowSpacing}>{eyebrow}</Eyebrow>
      <View style={s.row}>
        <Text size={13.5} color={theme.colors.content.secondary}>You escrow</Text>
        <Text style={[s.v, { color: theme.colors.content.primary }]}>
          {formatAssetAmount(String(principalRaw), asset)}
        </Text>
      </View>
      <View style={s.row}>
        <Text size={13.5} color={theme.colors.content.secondary}>
          {`Platform fee (${feePct}%)`}
        </Text>
        <Text style={[s.v, { color: theme.colors.content.secondary }]}>
          {feeRaw != null ? `− ${formatAssetAmount(String(feeRaw), asset)}` : '—'}
        </Text>
      </View>
      <View
        style={[
          s.row,
          s.totalRow,
          { borderTopColor: theme.colors.border.subtle },
        ]}
      >
        <Text size={13.5} weight="semibold" color={theme.colors.content.primary}>
          Worker receives
        </Text>
        <Text style={[s.vTotal, { color: theme.colors.content.primary }]}>
          {workerReceivesRaw != null ? formatAssetAmount(String(workerReceivesRaw), asset) : '—'}
        </Text>
      </View>
      <Text size={11.5} color={theme.colors.content.tertiary} style={s.note}>
        You escrow the full budget. The {feePct}% fee is taken from the worker&apos;s payout on completion.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyebrowSpacing: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  v: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.065,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  vTotal: {
    fontFamily: typography.fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.075,
  },
  note: {
    marginTop: 10,
    lineHeight: 16,
  },
})
