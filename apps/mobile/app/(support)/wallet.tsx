import { View, Linking, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ExternalLink, AlertTriangle } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Header, Text, Spacer, Card, Button, AccordionItem } from '@/components/ui'
import { GuideStep } from '@/components/support/GuideStep'
import { APP_INFO } from '@/lib/app-info'

export default function WalletGuideScreen() {
  const { theme } = useUnistyles()

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Header title="Wallet Setup" showBack />
      <Spacer size={spacing.md} />

      <Card variant="outlined" padding={spacing.md}>
        <Text variant="label" weight="semibold" color={theme.colors.textSub}>
          WHAT IS A CRYPTO WALLET?
        </Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" weight='medium' color={theme.colors.textSub}>
          Think of it like a bank account; but only you control it. No bank, no middleman.
          Your wallet holds your money and approves transactions when you confirm them.
          Tenda uses your wallet as your identity and payment method.
        </Text>
      </Card>

      <Spacer size={spacing.md} />

      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        PHANTOM (RECOMMENDED)
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        <View style={s.walletHeader}>
          <View style={s.walletHeaderInfo}>
            <Text variant="label" weight="semibold">Phantom</Text>
            <Text variant="caption" color={theme.colors.success}>
              Returns to Tenda automatically after connecting
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} color={theme.colors.primary} />}
            onPress={() => Linking.openURL(APP_INFO.wallets.phantom.playStore)}
          >
            Install
          </Button>
        </View>
        <View style={s.steps}>
          <GuideStep step={1} title="Install Phantom from the Play Store" />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={2}
            title="Open Phantom and create a new wallet or restore existing wallet"
            description="Tap 'Create a new wallet' or 'restore wallet' on the welcome screen."
          />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={3}
            title="Back up your secret recovery phrase"
            warning="Write down all 12 words in order and store them safely offline. Never share them with anyone; not even Tenda."
          />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={4}
            title="Return to Tenda and tap Connect Wallet"
            description="Phantom will open automatically. Tap Approve/Connect and you'll be returned to Tenda instantly."
          />
        </View>
      </Card>

      <Spacer size={spacing.md} />

      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        SOLFLARE
      </Text>
      <Spacer size={spacing.sm} />

      <View style={[s.warningBanner, { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning }]}>
        <AlertTriangle size={16} color={theme.colors.warning} />
        <Text variant="caption" color={theme.colors.warning} style={s.warningText}>
          Solflare requires two extra steps, read carefully before connecting.
        </Text>
      </View>
      <Spacer size={spacing.sm} />

      <Card variant="outlined" padding={0}>
        <View style={s.walletHeader}>
          <Text variant="label" weight="semibold" style={s.walletHeaderInfo}>Solflare</Text>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} color={theme.colors.primary} />}
            onPress={() => Linking.openURL(APP_INFO.wallets.solflare.playStore)}
          >
            Install
          </Button>
        </View>
        <View style={s.steps}>
          <GuideStep step={1} title="Install Solflare from the Play Store" />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Open Solflare and create a new wallet or restore an existing wallet" />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={3}
            title="Back up your seed phrase before connecting"
            warning="Solflare shows a backup reminder every time it opens until you complete this. Do it first to avoid interruptions when Tenda tries to connect."
          />
          <Spacer size={spacing.sm} />
          <GuideStep step={4} title="Return to Tenda and tap Connect Wallet" />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={5}
            title="After approving, press the Android back button"
            tip="Unlike Phantom, Solflare might not return you to Tenda automatically. Tap the ← back arrow at the bottom of your screen after you approve/connect."
          />
        </View>
      </Card>

      <Spacer size={spacing.md} />

      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        TROUBLESHOOTING
      </Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        <AccordionItem title="Connection keeps failing">
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textSub}>
            1. Make sure your wallet app is installed and fully set up.{'\n'}
            2. If using Solflare, complete the seed phrase backup inside the Solflare app first.{'\n'}
            3. Check your internet connection.{'\n'}
            4. Close and reopen Tenda, then try again.
          </Text>
        </AccordionItem>
        <AccordionItem title="I closed the wallet by mistake">
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textSub}>
            Tap "Try again" on the error screen then "Connect Wallet" to reopen the prompt.
          </Text>
        </AccordionItem>
        <AccordionItem title="My wallet isn't listed" last>
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textSub}>
            Tenda officially supports Phantom and Solflare. Other wallets that
            support the Solana Mobile Wallet Adapter may also work but are not
            tested yet.
          </Text>
        </AccordionItem>
      </Card>

      <Spacer size={spacing.md} />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    paddingHorizontal: 4,
    letterSpacing: 0.8,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  walletHeaderInfo: {
    flex: 1,
  },
  steps: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
  },
})
