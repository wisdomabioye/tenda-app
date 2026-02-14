import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { Wallet, ShieldCheck, Zap, ArrowLeft } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Spacer } from '@/components/ui/Spacer'
import { useAuthStore } from '@/stores/auth.store'
import { authorizeWalletSession, buildAuthMessage, signMessageWithWallet } from '@/wallet'

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

export default function ConnectWalletScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectNotice, setConnectNotice] = useState<string | null>(null)
  const { authenticateWithWallet, mwaAuthToken } = useAuthStore()

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true)
      setConnectNotice(null)

      const session = await authorizeWalletSession(mwaAuthToken ?? undefined)

      if (session) {
        const message = buildAuthMessage(session.walletAddress)
        const signature = await signMessageWithWallet(message, session.authToken, session.base64Address)
        await authenticateWithWallet(
          { wallet_address: session.walletAddress, signature, message },
          { mwaAuthToken: session.authToken, walletAddress: session.walletAddress },
        )

        router.replace('/(tabs)/home')
      } else {
        setConnectNotice('Connection was cancelled. You can try again anytime.')
      }
    } catch (error) {
      console.log('error', error)
      router.replace('/error')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.screen}>
        {/* Back button */}
        <View style={s.topBar}>
          <IconButton
            icon={<ArrowLeft size={22} color={theme.colors.text} />}
            onPress={() => router.back()}
            variant="ghost"
          />
        </View>

        <Spacer flex={1} />

        {/* Hero section */}
        <View style={s.hero}>
          <View style={[s.walletIconCircle, { backgroundColor: theme.colors.primaryTint }]}>
            <Image source={Logo} style={s.logo} contentFit="contain" />
          </View>
          <Spacer size={spacing.lg} />
          <Text variant="heading" align="center">
            Connect your wallet
          </Text>
          <Spacer size={spacing.sm} />
          <Text variant="body" align="center" color={theme.colors.textSub}>
            Link a Solana wallet to start posting{'\n'}and accepting gigs on Tenda
          </Text>
        </View>

        <Spacer size={spacing['2xl']} />

        {/* Feature list */}
        <View style={s.features}>
          {FEATURES.map(({ Icon, title, description }) => (
            <View key={title} style={s.featureRow}>
              <View style={[s.featureIcon, { backgroundColor: theme.colors.primaryTint }]}>
                <Icon size={24} color={theme.colors.primary} />
              </View>
              <View style={s.featureText}>
                <Text variant="body" weight="bold">{title}</Text>
                <Text variant="body" color={theme.colors.textSub}>
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
            size="xl"
            fullWidth
            loading={isConnecting}
            icon={<Wallet size={20} color={theme.colors.onPrimary} />}
            onPress={(handleConnectWallet)}
          >
            Connect Wallet
          </Button>
          {connectNotice ? (
            <View style={[s.notice, { backgroundColor: theme.colors.warningTint }]}>
              <Text variant="caption" color={theme.colors.onWarning}>
                {connectNotice}
              </Text>
            </View>
          ) : null}
          <Spacer size={spacing.md} />
          <Text
            variant="caption"
            align="center"
            color={theme.colors.textFaint}
          >
            By connecting, you agree to our Terms of Service
          </Text>
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  hero: {
    alignItems: 'center',
  },
  walletIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 52,
    height: 52,
  },
  features: {
    gap: spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  cta: {
    width: '100%',
  },
  notice: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
})
