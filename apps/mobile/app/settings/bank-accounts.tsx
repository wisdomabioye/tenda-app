import { useCallback, useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  SUPPORTED_PAYOUT_COUNTRIES,
  getPayoutSpec,
  type BankAccountSummary,
} from '@tenda/shared'
import { ScreenContainer, Text, Header, Button, BottomSheet, ConfirmDialog, showToast } from '@/components/ui'
import { CountrySelector, PayoutAccountForm, PayoutAccountRow, type PayoutFormValue } from '@/components/payout'
import { api, ApiClientError } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { spacing } from '@/theme/tokens'

/** The user's country when it's a supported payout market, else the first one. */
function defaultCountry(home: string | null): string {
  return home !== null && SUPPORTED_PAYOUT_COUNTRIES.includes(home) ? home : SUPPORTED_PAYOUT_COUNTRIES[0]
}

/**
 * Settings → Payout accounts. Country + rail (bank / mobile money) fields and
 * validation come from the shared payout-spec registry, so the form always
 * matches what the server accepts. NIP name-enquiry (NG bank) fills the holder
 * name server-side when configured; otherwise it's user-supplied + unverified.
 */
export default function PayoutAccountsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const homeCountry = useAuthStore((s) => s.user?.country ?? null)

  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [country, setCountry] = useState(() => defaultCountry(homeCountry))
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BankAccountSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    api.fiat.bankAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const spec = getPayoutSpec(country)

  async function handleSave(value: PayoutFormValue) {
    setSaving(true)
    try {
      await api.fiat.createBankAccount({
        country,
        kind: value.kind,
        bank_code: value.bank_code.trim(),
        account_number: value.account_number.trim(),
        account_name: value.account_name.trim(),
        is_default: (accounts?.length ?? 0) === 0,
      })
      showToast('success', 'Payout account saved')
      setAddOpen(false)
      load()
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not save the account')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    const a = deleteTarget
    if (a === null) return
    setDeleting(true)
    try {
      await api.fiat.deleteBankAccount({ id: a.id })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not remove the account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Payout accounts" showBack onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={s.content}>
        {accounts?.map((a) => (
          <PayoutAccountRow key={a.id} account={a} onDelete={setDeleteTarget} />
        ))}
        {accounts !== null && accounts.length === 0 && (
          <Text size={13} color={theme.colors.content.tertiary} align="center" style={s.empty}>
            No payout accounts saved yet.
          </Text>
        )}

        <Button variant="outline" size="lg" fullWidth onPress={() => setAddOpen(true)}>
          Add payout account
        </Button>
      </ScrollView>

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add payout account">
        <View style={s.sheetBody}>
          <CountrySelector selected={country} onSelect={setCountry} />
          {spec !== null && <PayoutAccountForm spec={spec} saving={saving} onSubmit={handleSave} />}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remove account"
        message={
          deleteTarget !== null ? `${deleteTarget.account_name} · ${deleteTarget.account_number_masked}` : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: { padding: spacing.md, gap: 10 },
  empty: { paddingVertical: 16 },
  sheetBody: { gap: 12 },
})
