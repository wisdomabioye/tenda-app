import { useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Header, Text, Spacer, Card, Input, AccordionItem } from '@/components/ui'
import { formatNaira } from '@/lib/currency'
import { APP_INFO } from '@/lib/app-info'

export default function EscrowGuideScreen() {
  const { theme } = useUnistyles()
  const [gigAmount, setGigAmount] = useState('')

  const numericAmount = parseFloat(gigAmount.replace(/,/g, '')) || 0
  const platformFee = numericAmount * (APP_INFO.fees.platformFeePct / 100)
  const workerReceives = numericAmount - platformFee
  const hasAmount = numericAmount > 0

  return (
    <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Header title="Payments & Escrow" showBack />
      <Spacer size={spacing.md} />

      {/* What is escrow */}
      <Card variant="outlined" padding={spacing.md}>
        <Text variant="label" weight="semibold" color={theme.colors.textSub}>
          WHAT IS ESCROW?
        </Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" color={theme.colors.textSub}>
          Escrow is like a trusted lockbox. When a poster publishes a gig, the payment
          is locked on-chain. The worker can see the money is real and available.
          The poster cannot take it back unless the gig expires or a dispute is resolved
          in their favour. When the poster approves the work, payment goes straight to the worker.
        </Text>
      </Card>

      <Spacer size={spacing.md} />

      {/* Money flow */}
      <Card variant="outlined" padding={spacing.md}>
        <Text variant="label" weight="semibold" color={theme.colors.textSub}>
          HOW THE MONEY MOVES
        </Text>
        <Spacer size={spacing.sm} />
        <View style={s.flowColumn}>
          <View style={[s.flowStep, { backgroundColor: theme.colors.primaryTint }]}>
            <Text variant="caption" weight="semibold" color={theme.colors.primary}>
              Poster publishes
            </Text>
            <Text variant="caption" color={theme.colors.primary}>
              Payment locked in escrow
            </Text>
          </View>
          <Text style={s.flowArrow} color={theme.colors.textFaint}>↓</Text>
          <View style={[s.flowStep, { backgroundColor: theme.colors.warningTint }]}>
            <Text variant="caption" weight="semibold" color={theme.colors.warning}>
              Work done
            </Text>
            <Text variant="caption" color={theme.colors.warning}>
              Worker submits proof
            </Text>
          </View>
          <Text style={s.flowArrow} color={theme.colors.textFaint}>↓</Text>
          <View style={[s.flowStep, { backgroundColor: theme.colors.successTint }]}>
            <Text variant="caption" weight="semibold" color={theme.colors.success}>
              Approved
            </Text>
            <Text variant="caption" color={theme.colors.success}>
              Worker gets paid
            </Text>
          </View>
        </View>
      </Card>

      <Spacer size={spacing.md} />

      {/* Fee calculator */}
      <Card variant="outlined" padding={spacing.md}>
        <Text variant="label" weight="semibold" color={theme.colors.textSub}>
          FEE CALCULATOR
        </Text>
        <Spacer size={spacing.xs} />
        <Text variant="caption" color={theme.colors.textFaint}>
          Tenda takes {APP_INFO.fees.platformFeePct}% of the gig amount. The rest goes to the worker.
        </Text>
        <Spacer size={spacing.sm} />
        <Input
          label="Gig amount (₦)"
          placeholder="e.g. 50000"
          value={gigAmount}
          onChangeText={setGigAmount}
          keyboardType="numeric"
        />
        {hasAmount && (
          <>
            <Spacer size={spacing.sm} />
            <View style={[s.breakdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={s.breakdownRow}>
                <Text variant="caption" color={theme.colors.textSub}>Gig amount</Text>
                <Text variant="caption" weight="semibold">{formatNaira(numericAmount)}</Text>
              </View>
              <View style={s.breakdownRow}>
                <Text variant="caption" color={theme.colors.textSub}>
                  Tenda fee ({APP_INFO.fees.platformFeePct}%)
                </Text>
                <Text variant="caption" color={theme.colors.danger}>−{formatNaira(platformFee)}</Text>
              </View>
              <View style={[s.breakdownRow, s.breakdownTotal, { borderTopColor: theme.colors.border }]}>
                <Text variant="label" weight="semibold">Worker receives</Text>
                <Text variant="label" weight="bold" color={theme.colors.success}>
                  {formatNaira(workerReceives)}
                </Text>
              </View>
            </View>
            <Spacer size={spacing.xs} />
            <Text variant="caption" color={theme.colors.textFaint}>
              Rate subject to change. A small Solana network fee (~₦50) also applies at time of transaction.
            </Text>
          </>
        )}
      </Card>

      <Spacer size={spacing.md} />

      {/* Disputes & refunds */}
      <Card variant="outlined" padding={0}>
        <AccordionItem title="What happens in a dispute?">
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textSub}>
            Either party can raise a dispute after proof is submitted. The Tenda team
            reviews both sides, the gig description, submitted proof, and any messages.
            Payment stays in escrow until a decision is made.
          </Text>
        </AccordionItem>
        <AccordionItem title="When is a refund issued?" last>
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textSub}>
            A refund goes back to the poster if:{'\n'}
            • The gig expires with no worker accepting it.{'\n'}
            • A dispute is resolved in the poster's favour.{'\n\n'}
            Refunds are sent back to the poster's wallet automatically on-chain.
          </Text>
        </AccordionItem>
      </Card>

      <Spacer size={spacing.md} />
    </ScreenContainer>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  kav: {
    flex: 1,
  },
  flowColumn: {
    gap: 2,
  },
  flowStep: {
    padding: spacing.sm,
    borderRadius: radius.md,
    gap: 2,
  },
  flowArrow: {
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
  },
  breakdown: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  breakdownTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
})
