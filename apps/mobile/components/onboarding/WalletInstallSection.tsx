import { View, Pressable, StyleSheet, Linking } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ExternalLink } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { Text, Spacer, Divider } from '@/components/ui'
import { APP_INFO } from '@/lib/app-info'

function WalletRow({ name, hint, storeUrl }: { name: string; hint: string; storeUrl: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.walletRow}>
      <View style={s.walletInfo}>
        <Text variant="label" weight="semibold">{name}</Text>
        <Text variant="caption" color={theme.colors.content.secondary}>{hint}</Text>
      </View>
      <Pressable
        onPress={() => Linking.openURL(storeUrl)}
        style={[s.installBtn, { backgroundColor: theme.colors.brand.primarySurface }]}
      >
        <ExternalLink size={14} color={theme.colors.brand.primary} />
        <Text size={12} weight="semibold" color={theme.colors.brand.primary}>Install</Text>
      </Pressable>
    </View>
  )
}

/** Last-slide content: wallet install options + the ToS/Privacy acceptance gate. */
export function WalletInstallSection({
  tosAccepted,
  onToggleTos,
}: {
  tosAccepted: boolean
  onToggleTos: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <View style={s.walletSection}>
      <View style={[s.walletCard, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.surface.card }]}>
        <WalletRow name="Phantom" hint="Recommended — returns automatically" storeUrl={APP_INFO.wallets.phantom.playStore} />
        <Divider spacing={0} />
        <WalletRow
          name="Solflare"
          hint="Back up seed phrase first, press ← after approving"
          storeUrl={APP_INFO.wallets.solflare.playStore}
        />
      </View>

      <Spacer size={spacing.md} />
      <Pressable onPress={onToggleTos} style={s.tosRow}>
        <View
          style={[
            s.checkbox,
            {
              borderColor: tosAccepted ? theme.colors.brand.primary : theme.colors.border.default,
              backgroundColor: tosAccepted ? theme.colors.brand.primary : 'transparent',
            },
          ]}
        >
          {tosAccepted && <Text size={10} weight="bold" color={theme.colors.brand.onPrimary}>✓</Text>}
        </View>
        <Text variant="caption" color={theme.colors.content.secondary} style={s.tosText}>
          I agree to the{' '}
          <Text variant="caption" color={theme.colors.content.link} onPress={() => Linking.openURL(APP_INFO.legal.terms)}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text variant="caption" color={theme.colors.content.link} onPress={() => Linking.openURL(APP_INFO.legal.privacy)}>
            Privacy Policy
          </Text>
        </Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  walletSection: { width: '100%' },
  walletCard: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  walletInfo: { flex: 1, gap: 2 },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  tosRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  tosText: { flex: 1 },
})
