import { useState } from 'react'
import { View, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { Wallet, ShieldCheck, Zap } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useAuthStore } from '@/stores/auth.store'
import { connectAndSignAuthMessage, WalletError } from '@/wallet'
import { APP_INFO } from '@/lib/app-info'

const Logo = require('@/assets/images/logo.png')

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: 'Secure escrow',
    description: 'Payments locked until work is approved',
  },
  {
    Icon: Zap,
    title: 'Instant settlement',
    description: 'Funds released on-chain in seconds',
  },
  {
    Icon: Wallet,
    title: 'Your keys, your money',
    description: 'Non-custodial — you control your wallet',
  },
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
        return {
          title: 'Connection cancelled',
          description: 'You closed the wallet prompt. Tap below to try again.',
        }
      case 'network':
        return {
          title: 'No connection',
          description: 'Check your internet connection and try again.',
        }
      case 'unknown':
      default:
        return {
          title: 'Something went wrong',
          description: 'An unexpected error occurred. Please try again.',
        }
    }
  }

  // Server-side errors (thrown after wallet connect, during authenticateWithWallet)
  const status = (error as any)?.statusCode ?? (error as any)?.status
  if (status === 401 || status === 403) {
    return {
      title: 'Sign-in failed',
      description: "The server couldn't verify your wallet. Please try again.",
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return {
      title: 'No connection',
      description: 'Check your internet connection and try again.',
    }
  }

  return {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  }
}

export default function ConnectWalletScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<ConnectError | null>(null)
  const { authenticateWithWallet, mwaAuthToken } = useAuthStore()

  const handleConnectWallet = async () => {
    setIsConnecting(true)
    setConnectError(null)
    try {
      const result = await connectAndSignAuthMessage(mwaAuthToken ?? undefined)

      if (result) {
        await authenticateWithWallet(
          { wallet_address: result.session.walletAddress, signature: result.signature, message: result.message },
          { mwaAuthToken: result.session.authToken, walletAddress: result.session.walletAddress },
        )
        router.replace('/(tabs)/home')
      } else {
        setConnectError({
          title: 'Connection cancelled',
          description: 'You closed the wallet prompt. Tap below to try again.',
        })
      }
    } catch (error) {
      console.log('connect error', error)
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
          />
        ) : (
          <>
            <Spacer flex={1} />

            {/* Hero section */}
            <View style={s.hero}>
              <View style={[s.walletIconCircle, { backgroundColor: theme.colors.primaryTint }]}>
                <Image source={Logo} style={s.logo} contentFit="contain" />
              </View>
              <Spacer size={spacing.md} />
              <Text variant="heading" align="center">
                Connect your wallet
              </Text>
              <Spacer size={spacing.sm} />
              <Text variant="body" align="center" color={theme.colors.textSub}>
                Link a Solana wallet to start posting{'\n'}and accepting gigs on Tenda
              </Text>
            </View>

            <Spacer size={spacing.md} />

            {/* Feature list */}
            <View style={s.features}>
              {FEATURES.map(({ Icon, title, description }) => (
                <View key={title} style={s.featureRow}>
                  <View style={[s.featureIcon, { backgroundColor: theme.colors.primaryTint }]}>
                    <Icon size={18} color={theme.colors.primary} />
                  </View>
                  <View style={s.featureText}>
                    <Text variant="label" weight="bold">{title}</Text>
                    <Text variant="caption" color={theme.colors.textSub}>
                      {description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Spacer flex={2} />

            {/* CTA */}
            <View style={s.cta}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isConnecting}
                icon={<Wallet size={18} color={theme.colors.onPrimary} />}
                onPress={handleConnectWallet}
              >
                Connect Wallet
              </Button>
              <Spacer size={spacing.md} />
              {isConnecting && (
                <View style={s.solfareTip}>
                  <Text variant="caption" align="center" color={theme.colors.textSub}>
                    Using Solflare? Back up your seed phrase if prompted, then press ← back to return.
                  </Text>
                </View>
              )}
              {!isConnecting && (
                <Text variant="caption" align="center" color={theme.colors.textFaint}>
                  By connecting, you agree to our Terms of Service
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  hero: {
    alignItems: 'center',
  },
  walletIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 40,
    height: 40,
  },
  features: {
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  cta: {
    width: '100%',
  },
  solfareTip: {
    paddingHorizontal: spacing.sm,
  },
})
