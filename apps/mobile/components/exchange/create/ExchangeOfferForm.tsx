import { useState } from 'react'
import {
  View, Alert, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { Button, Spacer } from '@/components/ui'
import { StepIndicator, STEPS } from './StepIndicator'
import { OfferDetailsStep } from './OfferDetailsStep'
import { TimingStep } from './TimingStep'
import { PaymentMethodsStep } from './PaymentMethodsStep'
import { ReviewStep } from './ReviewStep'
import { api } from '@/api/client'
import type { Step } from './StepIndicator'
import type { PaymentMethodFormEntry } from './PaymentMethodsStep'
import type { SupportedCurrency, UserExchangeAccount } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000
const LAST_STEP = (STEPS.length - 1) as Step

export interface ExchangeOfferFormValues {
  solInput:         string
  fiatInput:        string
  currency:         SupportedCurrency
  rateInput:        string
  windowSeconds:    number
  hasDeadline:      boolean
  deadlineInput:    string
  selectedAccounts: UserExchangeAccount[]
  newMethods:       PaymentMethodFormEntry[]
}

interface Props {
  initialValues?: Partial<ExchangeOfferFormValues>
  offerId?:       string           // present in edit mode
  submitLabel:    string
  onSuccess:      (id: string) => void
}

export function ExchangeOfferForm({ initialValues, offerId, submitLabel, onSuccess }: Props) {
  const router     = useRouter()
  const { theme }  = useUnistyles()

  const [step, setStep]           = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)

  const [solInput, setSolInput]   = useState(initialValues?.solInput  ?? '')
  const [fiatInput, setFiatInput] = useState(initialValues?.fiatInput ?? '')
  const [currency, setCurrency]   = useState<SupportedCurrency>(initialValues?.currency ?? 'NGN')
  const [rateInput, setRateInput] = useState(initialValues?.rateInput ?? '')

  const [windowSeconds, setWindowSeconds] = useState(initialValues?.windowSeconds ?? 86_400)
  const [hasDeadline, setHasDeadline]     = useState(initialValues?.hasDeadline   ?? false)
  const [deadlineInput, setDeadlineInput] = useState(initialValues?.deadlineInput ?? '')

  const [selectedAccounts, setSelectedAccounts] = useState<UserExchangeAccount[]>(initialValues?.selectedAccounts ?? [])
  const [newMethods, setNewMethods]             = useState<PaymentMethodFormEntry[]>(initialValues?.newMethods ?? [])

  const solNum  = parseFloat(solInput)  || 0
  const fiatNum = parseFloat(fiatInput) || 0
  const rateNum = parseFloat(rateInput) || (solNum > 0 ? Math.round(fiatNum / solNum) : 0)

  const allMethods: PaymentMethodFormEntry[] = [
    ...selectedAccounts.map((a) => ({
      _key: a.id, method: a.method, account_name: a.account_name,
      account_number: a.account_number, bank_name: a.bank_name ?? undefined,
      additional_info: a.additional_info ?? '',
    })),
    ...newMethods,
  ]

  function canAdvance(): boolean {
    if (step === 0) return solNum > 0 && fiatNum > 0
    if (step === 2) {
      return selectedAccounts.length > 0 ||
        newMethods.some((m) => m.method.trim() && m.account_name.trim() && m.account_number.trim())
    }
    return true
  }

  function back() {
    setStep((s) => (s - 1) as Step)
  }

  function advance() {
    if (!canAdvance()) {
      Alert.alert('Incomplete', 'Please fill in all required fields.')
      return
    }
    if (step < LAST_STEP) {
      setStep((s) => (s + 1) as Step)
    } else {
      handleSubmit()
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const newAccountIds = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        newMethods.map(({ _key, ...data }) => api.exchangeAccounts.create(data).then((a) => a.id))
      )
      const accountIds = [...selectedAccounts.map((a) => a.id), ...newAccountIds]

      const payload = {
        lamports_amount:        Math.round(solNum * LAMPORTS_PER_SOL),
        fiat_amount:            fiatNum,
        fiat_currency:          currency,
        rate:                   rateNum,
        payment_window_seconds: windowSeconds,
        accept_deadline:        hasDeadline && deadlineInput ? deadlineInput : undefined,
        account_ids:            accountIds,
      }

      let id: string
      if (offerId) {
        const updated = await api.exchange.update({ id: offerId }, payload)
        id = updated.id
      } else {
        const created = await api.exchange.create(payload)
        id = created.id
      }

      onSuccess(id)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <StepIndicator current={step} />

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
            submitLabel={submitLabel}
          />
        )}
        <Spacer size={spacing.xl} />
      </ScrollView>

      {/* ── Bottom nav ── */}
      <View style={[s.nav, { borderTopColor: theme.colors.borderFaint, backgroundColor: theme.colors.background }]}>
        {step > 0 && (
          <Button
            variant="outline"
            size="md"
            icon={<ChevronLeft size={16} color={theme.colors.primary} />}
            onPress={back}
            style={s.backBtn}
          >
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          loading={submitting}
          icon={step < LAST_STEP ? <ChevronRight size={16} color={theme.colors.onPrimary} /> : undefined}
          onPress={advance}
          style={step > 0 ? s.nextBtn : s.nextBtnFull}
        >
          {step === LAST_STEP ? submitLabel : 'Continue'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  scroll:      { paddingBottom: spacing['2xl'] },
  nav:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1 },
  backBtn:     { width: 96 },
  nextBtn:     { flex: 1 },
  nextBtnFull: { flex: 1 },
})
