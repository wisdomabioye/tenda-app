import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { computePlatformFee } from '@tenda/shared'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { formatSolDisplay } from '@/lib/currency'

const LAMPORTS_PER_SOL = 1_000_000_000

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
  const isSeeker = useAuthStore((s) => s.user?.is_seeker ?? false)
  const [feeBps, setFeeBps] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.platform.config()
      .then((cfg) => {
        if (cancelled) return
        setFeeBps(isSeeker ? cfg.seeker_fee_bps : cfg.fee_bps)
      })
      .catch(() => { /* fall back — rows render placeholder */ })
    return () => { cancelled = true }
  }, [isSeeker])

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
      <Text style={[s.eyebrow, { color: theme.colors.content.tertiary }]}>
        {eyebrow}
      </Text>
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
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    marginBottom: 10,
    includeFontPadding: false,
  },
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
