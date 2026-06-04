import { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, Pressable, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Landmark } from 'lucide-react-native'
import { LAMPORTS_PER_SOL, type BankAccountSummary } from '@tenda/shared'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useFiatQuote } from '@/hooks/useFiatQuote'
import { spacing } from '@/theme/tokens'

type Tab = 'buy' | 'sell'

/**
 * Buy/Sell page (stage-8 § Mobile) — Naira-first; the traded asset is the
 * wallet's native asset pre-cutover (SOL; USDC arrives with the licensed
 * providers). Buy gracefully degrades to "not available yet" until a
 * provider with onramp capability is live (#61).
 */
export default function BuySellScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  const [active, setActive] = useState<Tab>(tab === 'sell' ? 'sell' : 'buy')

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Buy / Sell" showBack onBackPress={() => router.back()} />

      <View style={s.tabRow}>
        {(['buy', 'sell'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActive(t)}
            style={[
              s.tab,
              {
                backgroundColor: active === t ? theme.colors.brand.primary : theme.colors.surface.card,
                borderColor: active === t ? theme.colors.brand.primary : theme.colors.border.default,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t === 'buy' ? 'Buy tab' : 'Sell tab'}
          >
            <Text
              size={14}
              weight="semibold"
              color={active === t ? theme.colors.brand.onPrimary : theme.colors.content.primary}
            >
              {t === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </Pressable>
        ))}
      </View>

      {active === 'buy' ? <BuyTab /> : <SellTab />}
    </ScreenContainer>
  )
}

// ---------- shared pieces ----------------------------------------------------

function QuoteSummary({ rate, fee, receiveLine, expiresIn }: { rate: number; fee: number; receiveLine: string; expiresIn: number }) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.quoteCard, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}>
      <Row label="Rate" value={`₦${rate.toLocaleString()} / SOL`} />
      <Row label="Conversion fee" value={fee > 0 ? `₦${fee.toLocaleString()}` : 'Free'} />
      <Row label="You receive" value={receiveLine} bold />
      <Text size={11.5} color={theme.colors.content.tertiary}>
        {expiresIn > 0 ? `Quote valid for ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}` : 'Quote expired — amounts refresh on change'}
      </Text>
    </View>
  )
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      <Text size={13} color={theme.colors.content.secondary}>{label}</Text>
      <Text size={13.5} weight={bold ? 'semibold' : 'regular'}>{value}</Text>
    </View>
  )
}

function UnavailableNotice({ copy }: { copy: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.unavailable, { backgroundColor: theme.colors.surface.inset }]}>
      <Text size={13} color={theme.colors.content.secondary} align="center" style={s.unavailableText}>
        {copy}
      </Text>
    </View>
  )
}

// ---------- Buy (onramp) -------------------------------------------------------

function BuyTab() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [amount, setAmount] = useState('')
  const fiatAmount = Number(amount)
  const valid = Number.isFinite(fiatAmount) && fiatAmount > 0
  const { quote, expiresIn, loading, error } = useFiatQuote(
    valid ? { direction: 'onramp', fiatAmount } : null,
  )
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (quote === null || submitting) return
    setSubmitting(true)
    try {
      const result = await api.fiat.onramp({ intent_id: quote.intent_id })
      if (result.kyc_url !== null) {
        await Linking.openURL(result.kyc_url)
      } else if ('kind' in result.instruction && result.instruction.kind === 'redirect') {
        await Linking.openURL(result.instruction.url)
      }
      router.replace({ pathname: '/wallet/intents/[id]', params: { id: result.intent_id } })
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not start the purchase')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <SectionLabel>Amount</SectionLabel>
      <Input
        label="You pay (NGN)"
        placeholder="15000"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {error === 'unavailable' && (
        <UnavailableNotice copy="Buying isn't available yet — licensed providers are coming soon. You can still sell via the P2P exchange." />
      )}
      {error === 'failed' && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>
          Could not fetch a quote — please try again.
        </Text>
      )}

      {quote !== null && (
        <>
          <QuoteSummary
            rate={quote.rate}
            fee={quote.fee_amount}
            receiveLine={`~${(Number(quote.asset_amount_raw) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
            expiresIn={expiresIn}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={expiresIn <= 0}
            onPress={() => void handleConfirm()}
          >
            Confirm purchase
          </Button>
        </>
      )}
      {loading && quote === null && error === null && (
        <Text size={12.5} color={theme.colors.content.tertiary}>Fetching quote…</Text>
      )}
    </ScrollView>
  )
}

// ---------- Sell (offramp) -------------------------------------------------------

function SellTab() {
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
        showToast('success', 'Offer created — publish it to match with a buyer')
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
    <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <SectionLabel>Amount</SectionLabel>
      <Input
        label="You sell (SOL)"
        placeholder="2.5"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <SectionLabel>Payout account</SectionLabel>
      {accounts !== null && accounts.length === 0 && (
        <Button variant="outline" size="md" fullWidth onPress={() => router.push('/settings/bank-accounts' as Parameters<typeof router.push>[0])}>
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
        <UnavailableNotice copy="No cash-out route is available for this amount right now — please try again later." />
      )}
      {error === 'failed' && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>
          Could not fetch a quote — please try again.
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
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  body: { padding: spacing.md, gap: 12 },
  quoteCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  unavailable: { borderRadius: 12, padding: 14 },
  unavailableText: { lineHeight: 18 },
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
