import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { typography } from '@/theme/tokens'
import { Text, showToast } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { DevnetBadge } from '@/components/feedback'
import { formatFiat } from '@/lib/currency'
import { truncateWallet } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

/**
 * Wallet balance hero card — copy-address chip, SOL total + fiat estimate,
 * and the Buy/Sell entry point. Self-contained: owns the copy + navigation
 * actions; the screen passes only display data.
 */
export function WalletHeroCard({
  walletAddress,
  balanceSol,
  balanceFiat,
  currency,
  isLoading,
}: {
  walletAddress: string | null
  balanceSol: number | null
  balanceFiat: number | null
  currency: SupportedCurrency
  isLoading: boolean
}) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const truncatedAddress = walletAddress ? truncateWallet(walletAddress) : null

  async function copyAddress() {
    if (!walletAddress) return
    await Clipboard.setStringAsync(walletAddress)
    showToast('success', 'Address copied')
  }

  return (
    <View
      style={[
        s.hero,
        { backgroundColor: theme.colors.brand.primarySurface, borderColor: theme.colors.brand.primaryBorder },
      ]}
    >
      {truncatedAddress && (
        <Pressable
          onPress={copyAddress}
          style={({ pressed }) => [
            s.heroAddr,
            { backgroundColor: theme.colors.surface.background },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Copy wallet address"
          accessibilityRole="button"
        >
          <Text style={[s.heroAddrText, { color: theme.colors.content.tertiary }]}>{truncatedAddress}</Text>
          <Copy size={11} color={theme.colors.content.tertiary} />
        </Pressable>
      )}

      <View style={s.heroLabelRow}>
        <Text style={[s.heroLabel, { color: theme.colors.content.tertiary }]}>TOTAL BALANCE</Text>
        <DevnetBadge />
      </View>

      <View style={s.heroBalance}>
        <Text style={[s.heroGlyph, { color: theme.colors.content.tertiary }]}>◎</Text>
        {isLoading || balanceSol === null ? (
          <Skeleton width={140} height={42} />
        ) : (
          <>
            <Text style={[s.heroAmount, { color: theme.colors.content.primary }]}>{balanceSol.toFixed(2)}</Text>
            <Text style={[s.heroUnit, { color: theme.colors.content.tertiary }]}>SOL</Text>
          </>
        )}
      </View>

      {balanceFiat !== null && (
        <Text style={[s.heroFiat, { color: theme.colors.content.tertiary }]}>
          ≈ {formatFiat(balanceFiat, currency)}
        </Text>
      )}

      {/* Stage 8: Buy/Sell is a first-class wallet operation */}
      <Pressable
        onPress={() => router.push('/wallet/buy-sell' as Parameters<typeof router.push>[0])}
        style={({ pressed }) => [s.buySell, { backgroundColor: theme.colors.brand.primary }, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Buy or sell"
      >
        <Text style={[s.buySellText, { color: theme.colors.brand.onPrimary }]}>Buy / Sell</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 148,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  heroAddr: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroAddrText: { fontFamily: typography.fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 0.11 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontFamily: typography.fonts.mono, fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 1.0 },
  heroBalance: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  heroGlyph: { fontFamily: typography.fonts.mono, fontSize: 20, lineHeight: 22 },
  heroAmount: {
    fontFamily: typography.fonts.mono,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroUnit: { fontFamily: typography.fonts.mono, fontSize: 14, lineHeight: 18, fontWeight: '500' },
  buySell: { marginTop: 12, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  buySellText: { fontSize: 14, fontFamily: typography.fonts.body.semibold },
  heroFiat: { fontFamily: typography.fonts.mono, fontSize: 13, lineHeight: 17, marginTop: 6 },
})
