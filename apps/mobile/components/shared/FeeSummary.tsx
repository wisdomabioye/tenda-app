import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { computePlatformFee, LAMPORTS_PER_SOL } from '@tenda/shared'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useIsSeeker } from '@/stores/auth.store'
import { usePlatformConfigStore } from '@/stores/platform-config.store'
import { formatSolDisplay } from '@/lib/currency'

interface FeeSummaryProps {
  /** Principal amount in lamports — gig payment / offer escrow */
  principalLamports: number
  /** Optional eyebrow override; defaults to "YOU WILL ESCROW" */
  eyebrow?: string
  /** Total row label override; defaults to "Total to escrow" */
  totalLabel?: string
}

/**
 * Reusable platform-fee breakdown card used in create-gig and create-offer
 * review steps. Fetches platform config (seeker_fee_bps if user is seeker,
 * else fee_bps) and renders Principal / Platform fee / Total rows in mono.
 */
export function FeeSummary({
  principalLamports,
  eyebrow = 'YOU WILL ESCROW',
  totalLabel = 'Total to escrow',
}: FeeSummaryProps) {
  const { theme } = useUnistyles()
  const isSeeker = useIsSeeker()
  const config = usePlatformConfigStore((s) => s.config)
  const fetchConfig = usePlatformConfigStore((s) => s.fetch)

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const feeBps = config != null
    ? (isSeeker ? config.seeker_fee_bps : config.fee_bps)
    : null

  const principalSol = principalLamports / LAMPORTS_PER_SOL
  const feeLamports = feeBps != null
    ? Number(computePlatformFee(BigInt(principalLamports), feeBps))
    : null
  const feeSol = feeLamports != null ? feeLamports / LAMPORTS_PER_SOL : null
  const totalSol = feeSol != null ? principalSol + feeSol : null
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
        <Text size={13.5} color={theme.colors.content.secondary}>Principal</Text>
        <Text style={[s.v, { color: theme.colors.content.primary }]}>
          {formatSolDisplay(principalSol)}
        </Text>
      </View>
      <View style={s.row}>
        <Text size={13.5} color={theme.colors.content.secondary}>
          {`Platform fee (${feePct}%)`}
        </Text>
        <Text style={[s.v, { color: theme.colors.content.primary }]}>
          {feeSol != null ? formatSolDisplay(feeSol) : '—'}
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
          {totalLabel}
        </Text>
        <Text style={[s.vTotal, { color: theme.colors.content.primary }]}>
          {totalSol != null ? formatSolDisplay(totalSol) : '—'}
        </Text>
      </View>
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
})
