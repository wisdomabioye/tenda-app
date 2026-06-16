import { useState } from 'react'
import { View, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { Wallet, ShieldCheck, Zap } from 'lucide-react-native'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useAuthStore } from '@/stores/auth.store'
import { WalletError } from '@/wallet/errors'
import { ApiClientError } from '@/api/client'
import { WalletPicker } from '@/wallet/picker'
import type { WalletAdapter } from '@/wallet/adapters/types'
import { APP_INFO } from '@/lib/app-info'
import { isSeekerDevice, getDeviceCountry } from '@/lib/device'

const Logo = require('@/assets/images/logo.png')

const FEATURES = [
  { Icon: ShieldCheck, title: 'Secure escrow',          description: 'Payments locked until work is approved.' },
  { Icon: Zap,         title: 'Instant settlement',     description: 'Funds released on-chain in seconds.' },
  { Icon: Wallet,      title: 'Your keys, your money',  description: 'Non-custodial — you control your wallet.' },
] as const

type ConnectError = {
  title: string
  description: string
  secondaryLabel?: string
  onSecondaryPress?: () => void
}

function classifyError(error: unknown): ConnectError {
  if (error instanceof WalletError) {
    switch (error.code) {
      case 'no_wallet':
        return {
          title: 'No wallet found',
          description: 'Install Phantom or Solflare on your device, then come back to connect.',
          secondaryLabel: 'Get Phantom',
          onSecondaryPress: () => Linking.openURL(APP_INFO.wallets.phantom.playStore),
        }
      case 'declined':
        return { title: 'Connection cancelled', description: 'You closed the wallet prompt. Tap below to try again.' }
      case 'network':
        return { title: 'No connection', description: 'Check your internet connection and try again.' }
      case 'unknown':
      default:
        return { title: 'Something went wrong', description: 'An unexpected error occurred. Please try again.' }
    }
  }
  if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403)) {
    return { title: 'Sign-in failed', description: "The server couldn't verify your wallet. Please try again." }
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return { title: 'No connection', description: 'Check your internet connection and try again.' }
  }
  // Surface the underlying error on dev builds so an unverified wallet flow
  // (#68: Phantom iOS, MetaMask sign) is debuggable on-device instead of
  // hiding behind a generic message.
  const detail = error instanceof Error ? error.message : String(error)
  return {
    title: 'Something went wrong',
    description: __DEV__
      ? `Unexpected error: ${detail}`
      : 'An unexpected error occurred. Please try again.',
  }
}

export default function ConnectWalletScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [isConnecting, setIsConnecting] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [connectError, setConnectError] = useState<ConnectError | null>(null)
  const signInWithWallet = useAuthStore((st) => st.signInWithWallet)

  // Sign in with the wallet the user picked from the sheet. Each adapter owns
  // its own connect+sign round-trip; the store persists the session and routes
  // to onboarding vs home based on profile completeness.
  const handleSelectWallet = async (adapter: WalletAdapter) => {
    setPickerVisible(false)
    setIsConnecting(true)
    setConnectError(null)
    try {
      const ok = await signInWithWallet(adapter, {
        is_seeker: isSeekerDevice(),
        country: getDeviceCountry(),
      })
      if (ok) {
        // Stage 1: incomplete profiles detour through setup before home.
        const complete = useAuthStore.getState().profileComplete
        router.replace(complete ? '/(tabs)/home' : '/(auth)/profile-setup')
      } else {
        setConnectError({ title: 'Connection cancelled', description: 'You closed the wallet prompt. Tap below to try again.' })
      }
    } catch (error) {
      if (__DEV__) console.warn('[connect-wallet] sign-in failed:', error)
      setConnectError(classifyError(error))
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <View style={s.screen}>
        <Header showBack transparent />

        {connectError ? (
          <ErrorState
            title={connectError.title}
            description={connectError.description}
            ctaLabel="Try again"
            onCtaPress={() => setConnectError(null)}
            secondaryLabel={connectError.secondaryLabel}
            onSecondaryPress={connectError.onSecondaryPress}
            size="large"
          />
        ) : (
          <>
            <View style={s.hero}>
              <View style={s.heroCircleWrap}>
                <View
                  style={[s.heroCircle, { backgroundColor: theme.colors.brand.primarySurface }]}
                >
                  <Image source={Logo} style={s.heroLogo} contentFit="contain" />
                </View>
              </View>

              <Text style={[s.heroTitle, { color: theme.colors.content.primary }]}>
                Connect your wallet
              </Text>
              <Text style={[s.heroBody, { color: theme.colors.content.secondary }]}>
                Connect a wallet to start posting and accepting gigs on Tenda.
              </Text>
            </View>

            <View style={s.features}>
              {FEATURES.map(({ Icon, title, description }) => (
                <View key={title} style={s.featRow}>
                  <View style={[s.featIcon, { backgroundColor: theme.colors.brand.primarySurface }]}>
                    <Icon size={18} color={theme.colors.brand.primary} />
                  </View>
                  <View style={s.featBody}>
                    <Text style={[s.featTitle, { color: theme.colors.content.primary }]}>
                      {title}
                    </Text>
                    <Text style={[s.featDesc, { color: theme.colors.content.secondary }]}>
                      {description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.spacer} />

            {isConnecting && (
              <View style={[s.infoBanner, { backgroundColor: theme.colors.brand.primarySurface }]}>
                <View style={[s.tipIcon, { backgroundColor: theme.colors.brand.primary }]}>
                  <Text style={s.tipGlyph}>i</Text>
                </View>
                <Text style={[s.infoText, { color: theme.colors.brand.primary }]}>
                  If you&apos;re using Solflare, you may need to return to Tenda manually after connecting.
                </Text>
              </View>
            )}

            <View style={s.ctaStack}>
              <Button
                variant="primary"
                size="xl"
                fullWidth
                loading={isConnecting}
                icon={!isConnecting ? <Wallet size={18} color={theme.colors.brand.onPrimary} /> : undefined}
                onPress={() => setPickerVisible(true)}
              >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </Button>
              <Text style={[s.tos, { color: theme.colors.content.tertiary }]}>
                {isConnecting
                  ? 'Waiting for wallet approval — keep Tenda open.'
                  : (
                    <>
                      By connecting you agree to our{' '}
                      <Text style={[s.tosBold, { color: theme.colors.content.secondary }]}>Terms</Text>
                      {' '}and{' '}
                      <Text style={[s.tosBold, { color: theme.colors.content.secondary }]}>Privacy</Text>.
                    </>
                  )}
              </Text>
            </View>
          </>
        )}

        <WalletPicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={handleSelectWallet}
        />
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    paddingTop: 8,
    paddingHorizontal: 28,
    paddingBottom: 16,
    alignItems: 'center',
  },
  heroCircleWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: 44,
    height: 44,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.52,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  features: {
    paddingTop: 8,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 56,
  },
  featIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  featTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  featDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
  },
  infoBanner: {
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  tipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipGlyph: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  ctaStack: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  tos: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tosBold: {
    fontWeight: '600',
  },
})
