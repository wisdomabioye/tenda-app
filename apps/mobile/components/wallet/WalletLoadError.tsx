import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CloudOff } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui'

/**
 * Shown on the wallet screen when the linked-wallet load FAILED (as opposed to
 * "no wallet linked"): a transient /v1/users/me failure used to fall through to
 * the empty state, lying that the user had no wallet. Offers an explicit retry
 * so it recovers without a re-login.
 */
export function WalletLoadError({ onRetry }: { onRetry: () => void }) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.subtle },
      ]}
    >
      <View style={[s.icon, { backgroundColor: theme.colors.surface.background }]}>
        <CloudOff size={22} color={theme.colors.content.secondary} />
      </View>
      <Text style={[s.title, { color: theme.colors.content.primary }]}>Couldn’t load your wallets</Text>
      <Text style={[s.body, { color: theme.colors.content.secondary }]}>
        Check your connection and try again — your wallets are safe.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [s.button, { backgroundColor: theme.colors.brand.primary }, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Retry loading wallets"
      >
        <Text style={[s.buttonText, { color: theme.colors.brand.onPrimary }]}>Try again</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 280 },
  button: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 13, borderRadius: 14, marginTop: 18 },
  buttonText: { fontSize: 15, fontFamily: typography.fonts.body.semibold },
})
