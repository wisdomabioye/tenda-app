import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ExchangeStatusBadge } from '@/components/exchange'
import { formatFiat, formatPaymentWindow } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { computePlatformFee, LAMPORTS_PER_SOL } from '@tenda/shared'
import type { ExchangeOfferDetail, SupportedCurrency } from '@tenda/shared'
import { useGracePeriodSeconds } from '@/stores/platform-config.store'
import { useIsSeeker } from '@/stores/auth.store'
import { usePlatformConfigStore } from '@/stores/platform-config.store'

interface Props {
  offer: ExchangeOfferDetail
}

/**
 * Wireframe `card.osc-*` (§4.20 exchange/[id]). Border-only 18r card with:
 *   - Top row: status pill + payment-method chips (compact 22h inset pills)
 *   - Mono rate "X SOL → Y CCY" with 24/20 hierarchy and arrow
 *   - Sub line: rate-per-SOL + spread (mono, ink-3)
 *   - Divider, then 2-col meta cells (Payment window / Tenda fee or Escrow locked)
 */
export function OfferSummaryCard({ offer }: Props) {
  const { theme } = useUnistyles()
  const sol = Number(offer.lamports_amount) / LAMPORTS_PER_SOL
  const currency = offer.fiat_currency as SupportedCurrency
  const rate = offer.rate

  // Live USD-anchored market rate (where available) for the spread badge.
  const marketRate = useExchangeRateStore((s) => s.rates?.[currency] ?? null)
  const spreadPct = marketRate && marketRate > 0
    ? ((rate - marketRate) / marketRate) * 100
    : null

  // Compute platform fee using the live config (seeker rate when applicable).
  const isSeeker = useIsSeeker()
  const config = usePlatformConfigStore((s) => s.config)
  void useGracePeriodSeconds()  // ensures config loads on mount
  const feeBps = config != null
    ? (isSeeker ? config.seeker_fee_bps : config.fee_bps)
    : null
  const feeLamports = feeBps != null
    ? Number(computePlatformFee(BigInt(offer.lamports_amount), feeBps))
    : null
  const feeSol = feeLamports != null ? feeLamports / LAMPORTS_PER_SOL : null

  // After acceptance, escrow-locked = principal + platform fee.
  const escrowSol = feeSol != null ? sol + feeSol : null

  const showEscrow = offer.status === 'accepted' || offer.status === 'paid' ||
                     offer.status === 'completed' || offer.status === 'resolved'

  // Derive distinct payment-method names from the full accounts list — falls
  // back to the offer-level whitelist if accounts are masked (pre-accept buyer).
  const methodChips = Array.from(
    new Set(offer.payment_accounts.map((a) => a.method)),
  ).slice(0, 3)

  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
      ]}
    >
      {/* Top row — status + payment-method chips */}
      <View style={s.top}>
        <ExchangeStatusBadge status={offer.status} />
        {methodChips.map((pm) => (
          <View
            key={pm}
            style={[s.pmPill, { backgroundColor: theme.colors.surface.inset }]}
          >
            <Text style={[s.pmPillText, { color: theme.colors.content.secondary }]} numberOfLines={1}>
              {pm}
            </Text>
          </View>
        ))}
      </View>

      {/* Rate row */}
      <View style={s.rateRow}>
        <Text style={[s.rateFrom, { color: theme.colors.content.primary }]}>
          {sol.toFixed(sol >= 1 ? 2 : 3)}
          <Text style={[s.rateUnit, { color: theme.colors.content.tertiary }]}> SOL</Text>
        </Text>
        <Text style={[s.rateArrow, { color: theme.colors.content.tertiary }]}>→</Text>
        <Text style={[s.rateTo, { color: theme.colors.content.primary }]}>
          {offer.fiat_amount.toLocaleString()}
          <Text style={[s.rateUnit, { color: theme.colors.content.tertiary }]}> {currency}</Text>
        </Text>
      </View>

      {/* Rate-per-SOL + optional spread */}
      <Text style={[s.rateSub, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
        Rate: {formatFiat(rate, currency)} / SOL
        {spreadPct !== null && Math.abs(spreadPct) >= 0.1 && (
          <Text style={{
            color:
              spreadPct > 0
                ? theme.colors.feedback.success.base
                : theme.colors.feedback.warning.base,
          }}>
            {' · '}{spreadPct > 0 ? '+' : ''}{spreadPct.toFixed(1)}% {spreadPct > 0 ? 'above' : 'below'} market
          </Text>
        )}
      </Text>

      {/* Hidden when status doesn't surface meta cells (e.g. disputed compact). */}
      {offer.status !== 'disputed' && (
        <>
          <View style={[s.divider, { backgroundColor: theme.colors.border.subtle }]} />
          <View style={s.metaRow}>
            <View style={s.metaCell}>
              <Eyebrow>{showEscrow ? 'Escrow locked' : 'Payment window'}</Eyebrow>
              <Text style={[s.metaValue, { color: theme.colors.content.primary }]}>
                {showEscrow
                  ? (escrowSol != null ? `${escrowSol.toFixed(escrowSol >= 1 ? 3 : 4)} SOL` : '—')
                  : formatPaymentWindow(offer.payment_window_seconds)}
              </Text>
            </View>
            <View style={s.metaCell}>
              <Eyebrow>Tenda fee</Eyebrow>
              <Text style={[s.metaValue, { color: theme.colors.content.primary }]}>
                {feeSol != null ? `${feeSol.toFixed(feeSol >= 1 ? 3 : 4)} SOL` : '—'}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderRadius: 18,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  pmPill: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.105,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  rateFrom: {
    fontFamily: typography.fonts.mono,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.48,
  },
  rateTo: {
    fontFamily: typography.fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  rateArrow: {
    fontSize: 18,
    fontWeight: '500',
  },
  rateUnit: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  rateSub: {
    fontFamily: typography.fonts.mono,
    fontSize: 12,
    letterSpacing: 0.12,
    marginTop: 6,
  },
  divider: {
    height: 1,
    marginHorizontal: -18,
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metaCell: {
    flex: 1,
  },
  metaValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.07,
    marginTop: 4,
  },
})
