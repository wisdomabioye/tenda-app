import { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Landmark } from 'lucide-react-native'
import { LAMPORTS_PER_SOL, type BankAccountSummary } from '@tenda/shared'
import { Text, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useFiatQuote } from '@/hooks/useFiatQuote'
import { QuoteSummary, UnavailableNotice, tabBodyStyle } from './shared'

/** Sell (offramp): SOL out → NGN to a saved payout account. */
export function SellTab() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [amount, setAmount] = useState('')
  const sol = Number(amount)
  const valid = Number.isFinite(sol) && sol > 0
  const lamports = valid ? String(Math.floor(sol * LAMPORTS_PER_SOL)) : undefined

  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadAccounts = useCallback(() => {
    api.fiat
      .bankAccounts()
      .then((rows) => {
        setAccounts(rows)
        setSelected((cur) => cur ?? rows.find((r) => r.is_default)?.id ?? rows[0]?.id ?? null)
      })
      .catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const { quote, expiresIn, loading, error } = useFiatQuote(
    valid ? { direction: 'offramp', assetAmountRaw: lamports } : null,
  )

  async function handleConfirm() {
    if (quote === null || selected === null || submitting) return
    setSubmitting(true)
    try {
      const result = await api.fiat.offramp({ intent_id: quote.intent_id, bank_account_id: selected })
      const inst = result.instruction
      if ('kind' in inst && inst.kind === 'p2p') {
        showToast('success', 'Offer created, publish it to match with a buyer')
        router.replace(`/exchange/${inst.offer_id}` as Parameters<typeof router.replace>[0])
        return
      }
      router.replace({ pathname: '/wallet/intents/[id]', params: { id: result.intent_id } })
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not start the cash-out')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={tabBodyStyle} keyboardShouldPersistTaps="handled">
      <SectionLabel>Amount</SectionLabel>
      <Input label="You sell (SOL)" placeholder="2.5" value={amount} onChangeText={setAmount} keyboardType="numeric" />

      <SectionLabel>Payout account</SectionLabel>
      {accounts !== null && accounts.length === 0 && (
        <Button
          variant="outline"
          size="md"
          fullWidth
          onPress={() => router.push('/settings/bank-accounts' as Parameters<typeof router.push>[0])}
        >
          Add a bank account
        </Button>
      )}
      {accounts?.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => setSelected(a.id)}
          style={[
            s.accountRow,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: selected === a.id ? theme.colors.brand.primary : theme.colors.border.default,
            },
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === a.id }}
        >
          <Landmark size={16} color={theme.colors.content.secondary} />
          <View style={s.accountBody}>
            <Text size={13.5} weight="semibold">{a.account_name}</Text>
            <Text size={12} color={theme.colors.content.tertiary}>
              {a.bank_code} · {a.account_number_masked}
            </Text>
          </View>
        </Pressable>
      ))}

      {error === 'unavailable' && (
        <UnavailableNotice copy="No cash-out route is available for this amount right now, please try again later." />
      )}
      {error === 'failed' && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>
          Could not fetch a quote, please try again.
        </Text>
      )}

      {quote !== null && (
        <>
          <QuoteSummary
            rate={quote.rate}
            fee={quote.fee_amount}
            receiveLine={`₦${quote.fiat_amount.toLocaleString()}`}
            expiresIn={expiresIn}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={expiresIn <= 0 || selected === null}
            onPress={() => void handleConfirm()}
          >
            Confirm cash-out
          </Button>
          {selected === null && (
            <Text size={12} color={theme.colors.content.tertiary} align="center">
              Pick a payout account to continue.
            </Text>
          )}
        </>
      )}
      {loading && quote === null && error === null && (
        <Text size={12.5} color={theme.colors.content.tertiary}>Fetching quote…</Text>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  accountBody: { flex: 1, gap: 2 },
})
