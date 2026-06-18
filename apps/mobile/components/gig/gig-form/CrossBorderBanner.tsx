import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { isCrossBorder, LOCATIONS } from '@tenda/shared'
import type { CountryCode } from '@tenda/shared'

/**
 * Advisory banner shown when the gig's country differs from the poster's
 * home country — renders null when the posting isn't cross-border.
 */
export function CrossBorderBanner({
  remote,
  country,
  homeCountry,
  assetSymbol,
}: {
  remote: boolean
  country: string | null
  homeCountry: string | null
  assetSymbol: string
}) {
  const { theme } = useUnistyles()
  if (!isCrossBorder(remote, country, homeCountry)) return null

  return (
    <View
      style={[
        s.banner,
        { backgroundColor: theme.colors.brand.primarySurface, borderColor: theme.colors.brand.primaryBorder },
      ]}
    >
      <Text size={13} weight="semibold" color={theme.colors.brand.primary}>
        ↔ Cross-border posting
      </Text>
      <Text size={12} color={theme.colors.brand.primary} style={s.sub}>
        Workers in {LOCATIONS[country as CountryCode]?.name ?? country} receive {assetSymbol} and can off-ramp via
        Tenda P2P.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    gap: 2,
  },
  sub: { lineHeight: 17 },
})
