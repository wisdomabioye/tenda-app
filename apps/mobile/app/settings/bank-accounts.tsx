import { useCallback, useState } from 'react'
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Landmark, Trash2 } from 'lucide-react-native'
import type { BankAccountSummary } from '@tenda/shared'
import { ScreenContainer, Text, Header, Button, BottomSheet, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { api, ApiClientError } from '@/api/client'
import { spacing } from '@/theme/tokens'

/**
 * Settings → Bank accounts (stage-8 § Mobile). NIP name-enquiry validates
 * server-side once configured (#61); until then the holder name is
 * user-supplied and the account shows as unverified.
 */
export default function BankAccountsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.fiat
      .bankAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const canSave =
    bankCode.trim().length > 0 && /^\d{10}$/.test(accountNumber.trim()) && accountName.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await api.fiat.createBankAccount({
        country: 'NG',
        bank_code: bankCode.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        is_default: (accounts?.length ?? 0) === 0,
      })
      showToast('success', 'Bank account saved')
      setAddOpen(false)
      setBankCode('')
      setAccountNumber('')
      setAccountName('')
      load()
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not save the account')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(a: BankAccountSummary) {
    Alert.alert('Remove account', `${a.account_name} · ${a.account_number_masked}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          api.fiat
            .deleteBankAccount({ id: a.id })
            .then(load)
            .catch((e: unknown) =>
              showToast('error', e instanceof ApiClientError ? e.message : 'Could not remove the account'),
            )
        },
      },
    ])
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Bank accounts" showBack onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={s.content}>
        {accounts?.map((a) => (
          <View
            key={a.id}
            style={[s.row, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}
          >
            <Landmark size={18} color={theme.colors.content.secondary} />
            <View style={s.rowBody}>
              <Text size={14} weight="semibold">{a.account_name}</Text>
              <Text size={12} color={theme.colors.content.tertiary}>
                {a.bank_code} · {a.account_number_masked}
                {a.is_default ? ' · Default' : ''}
                {a.verified ? ' · Verified' : ''}
              </Text>
            </View>
            <Pressable onPress={() => handleDelete(a)} hitSlop={8} accessibilityLabel="Remove bank account" accessibilityRole="button">
              <Trash2 size={16} color={theme.colors.feedback.danger.base} />
            </Pressable>
          </View>
        ))}
        {accounts !== null && accounts.length === 0 && (
          <Text size={13} color={theme.colors.content.tertiary} align="center" style={s.empty}>
            No bank accounts saved yet.
          </Text>
        )}

        <Button variant="outline" size="lg" fullWidth onPress={() => setAddOpen(true)}>
          Add bank account
        </Button>
      </ScrollView>

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add bank account">
        <View style={s.form}>
          <Input label="Bank code (NIP)" placeholder="058" value={bankCode} onChangeText={setBankCode} keyboardType="numeric" />
          <Input label="Account number" placeholder="0123456789" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" maxLength={10} />
          <Input label="Account name" placeholder="ADAEZE OKOYE" value={accountName} onChangeText={setAccountName} autoCapitalize="characters" />
          <Button variant="primary" size="lg" fullWidth loading={saving} disabled={!canSave} onPress={() => void handleSave()}>
            Save account
          </Button>
        </View>
      </BottomSheet>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: { padding: spacing.md, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  rowBody: { flex: 1, gap: 2 },
  empty: { paddingVertical: 16 },
  form: { gap: 12, paddingTop: 8 },
})
