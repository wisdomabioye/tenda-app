import { useState } from 'react'
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ChevronRight } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import {
  ScreenContainer, 
  Button, 
  Spacer, 
  Header 
} from '@/components/ui'
import { 
  StepIndicator,
  OfferDetailsStep,
  TimingStep,
  PaymentMethodsStep,
  ReviewStep,
  type PaymentMethodFormEntry,
  type Step,
} from '@/components/exchange/create'
import { api } from '@/api/client'
import type { SupportedCurrency, UserExchangeAccount } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

export default function CreateExchangeOfferScreen() {
  const router    = useRouter()
  const { theme } = useUnistyles()

  const [step, setStep]             = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 0
  const [solInput, setSolInput]   = useState('')
  const [fiatInput, setFiatInput] = useState('')
  const [currency, setCurrency]   = useState<SupportedCurrency>('NGN')
  const [rateInput, setRateInput] = useState('')

  // Step 1
  const [windowSeconds, setWindowSeconds] = useState(86400)
  const [hasDeadline, setHasDeadline]     = useState(false)
  const [deadlineInput, setDeadlineInput] = useState('')

  // Step 2 — existing accounts the seller picks + any new ones they type in
  const [selectedAccounts, setSelectedAccounts] = useState<UserExchangeAccount[]>([])
  const [newMethods, setNewMethods]             = useState<PaymentMethodFormEntry[]>([])

  const solNum  = parseFloat(solInput)  || 0
  const fiatNum = parseFloat(fiatInput) || 0
  const rateNum = parseFloat(rateInput) || (solNum > 0 ? Math.round(fiatNum / solNum) : 0)

  // Flatten selected + new into a unified shape for ReviewStep
  const allMethods: PaymentMethodFormEntry[] = [
    ...selectedAccounts.map((a) => ({
      _key: a.id, method: a.method, account_name: a.account_name,
      account_number: a.account_number, bank_name: a.bank_name ?? undefined, additional_info: a.additional_info ?? '',
    })),
    ...newMethods,
  ]

  function canAdvance(): boolean {
    if (step === 0) return solNum > 0 && fiatNum > 0
    if (step === 2) {
      const hasSelected = selectedAccounts.length > 0
      const hasValidNew = newMethods.some((m) => m.method.trim() && m.account_name.trim() && m.account_number.trim())
      return hasSelected || hasValidNew
    }
    return true
  }

  function advance() {
    if (!canAdvance()) {
      Alert.alert('Incomplete', 'Please fill in all required fields.')
      return
    }
    if (step < 3) setStep((s) => (s + 1) as Step)
    else handleSubmit()
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      // Create only the new (unsaved) accounts; existing ones already have IDs
      const newAccountIds = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        newMethods.map(({ _key, ...accountData }) => api.exchangeAccounts.create(accountData).then((a) => a.id))
      )
      const accountIds = [...selectedAccounts.map((a) => a.id), ...newAccountIds]

      const offer = await api.exchange.create({
        lamports_amount:        Math.round(solNum * LAMPORTS_PER_SOL),
        fiat_amount:            fiatNum,
        fiat_currency:          currency,
        rate:                   rateNum,
        payment_window_seconds: windowSeconds,
        accept_deadline:        hasDeadline && deadlineInput ? deadlineInput : undefined,
        account_ids:            accountIds,
      })

      router.replace(`/exchange/${offer.id}` as any)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Sell SOL" showBack />
      <StepIndicator current={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <OfferDetailsStep
              solInput={solInput}   fiatInput={fiatInput}
              currency={currency}   rateInput={rateInput}
              onSolChange={setSolInput}   onFiatChange={setFiatInput}
              onCurrency={setCurrency}    onRateChange={setRateInput}
            />
          )}
          {step === 1 && (
            <TimingStep
              windowSeconds={windowSeconds}  hasDeadline={hasDeadline}
              deadlineInput={deadlineInput}
              onWindow={setWindowSeconds}    onHasDeadline={setHasDeadline}
              onDeadline={setDeadlineInput}
            />
          )}
          {step === 2 && (
            <PaymentMethodsStep
              selectedAccounts={selectedAccounts}  newMethods={newMethods}
              currency={currency}
              onSelectedAccounts={setSelectedAccounts}  onNewMethods={setNewMethods}
            />
          )}
          {step === 3 && (
            <ReviewStep
              solNum={solNum}    fiatNum={fiatNum}
              currency={currency}  rateNum={rateNum}
              windowSeconds={windowSeconds}
              hasDeadline={hasDeadline}  deadlineInput={deadlineInput}
              methods={allMethods}
            />
          )}
          <Spacer size={spacing.xl} />
        </ScrollView>

        <View style={[s.nav, { borderTopColor: theme.colors.borderFaint, backgroundColor: theme.colors.background }]}>
          {step > 0 && (
            <Button variant="outline" onPress={() => setStep((s) => (s - 1) as Step)} style={s.backBtn}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            fullWidth={step === 0}
            loading={submitting}
            icon={step < 3 ? <ChevronRight size={16} color={theme.colors.onPrimary} /> : undefined}
            onPress={advance}
            style={step > 0 ? s.nextBtn : undefined}
          >
            {step === 3 ? 'Save Draft' : 'Next'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll:  { paddingBottom: spacing['2xl'] },
  nav:     { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1 },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
})
