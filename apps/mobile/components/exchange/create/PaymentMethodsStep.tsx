import { useState, useEffect } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Plus, Trash2, Check } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, typography, radius } from '@/theme/tokens'
import { Text, Input, Spacer, Button, Card } from '@/components/ui'
import { api } from '@/api/client'
import type { CreateUserExchangeAccountInput, UserExchangeAccount } from '@tenda/shared'

export type PaymentMethodFormEntry = CreateUserExchangeAccountInput & { _key: string }

const blankMethod = (): PaymentMethodFormEntry => ({
  _key: Math.random().toString(36).slice(2),
  method: '', account_name: '', account_number: '', bank_name: '', additional_info: '',
})

interface Props {
  selectedAccounts:    UserExchangeAccount[]
  newMethods:          PaymentMethodFormEntry[]
  currency:            string
  onSelectedAccounts:  (accounts: UserExchangeAccount[]) => void
  onNewMethods:        (methods: PaymentMethodFormEntry[]) => void
}

export function PaymentMethodsStep({ selectedAccounts, newMethods, currency, onSelectedAccounts, onNewMethods }: Props) {
  const { theme } = useUnistyles()
  const [existingAccounts, setExistingAccounts] = useState<UserExchangeAccount[]>([])
  const [loadingAccounts,  setLoadingAccounts]  = useState(true)

  useEffect(() => {
    api.exchangeAccounts.list()
      .then((accounts) => setExistingAccounts(accounts.filter((a) => a.is_active)))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }, [])

  function toggleAccount(account: UserExchangeAccount) {
    const isSelected = selectedAccounts.some((a) => a.id === account.id)
    onSelectedAccounts(
      isSelected
        ? selectedAccounts.filter((a) => a.id !== account.id)
        : [...selectedAccounts, account],
    )
  }

  function updateNew(index: number, patch: Partial<CreateUserExchangeAccountInput>) {
    onNewMethods(newMethods.map((m, i) => i === index ? { ...m, ...patch } : m))
  }

  function removeNew(index: number) {
    onNewMethods(newMethods.filter((_, i) => i !== index))
  }

  return (
    <View style={s.wrap}>
      <Text variant="subheading">Payment methods</Text>
      <Text variant="caption" style={{ marginTop: 4 }}>
        How buyers send {currency} to you.
      </Text>
      <Spacer size={spacing.md} />

      {loadingAccounts ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: spacing.sm }} />
      ) : existingAccounts.length > 0 ? (
        <>
          <Text weight="semibold" size={typography.sizes.sm}>Your saved accounts</Text>
          <Spacer size={spacing.xs} />
          {existingAccounts.map((account) => {
            const selected = selectedAccounts.some((a) => a.id === account.id)
            return (
              <Pressable
                key={account.id}
                style={[
                  s.accountRow,
                  { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
                onPress={() => toggleAccount(account)}
              >
                <View style={s.accountInfo}>
                  <Text weight="medium" size={typography.sizes.sm}>{account.method}</Text>
                  <Text variant="caption" color={theme.colors.textSub}>
                    {account.account_name} · {account.account_number}
                    {account.bank_name ? ` · ${account.bank_name}` : ''}
                  </Text>
                </View>
                {selected && <Check size={16} color={theme.colors.primary} />}
              </Pressable>
            )
          })}
          <Spacer size={spacing.md} />
        </>
      ) : null}

      {newMethods.map((m, i) => (
        <Card key={m._key} variant="outlined" style={s.card}>
          <View style={s.cardHeader}>
            <Text weight="semibold" size={typography.sizes.sm}>New method {i + 1}</Text>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} color={theme.colors.danger} />}
              onPress={() => removeNew(i)}
            >
              Remove
            </Button>
          </View>
          <Spacer size={spacing.sm} />
          <Input
            label="Method name *"
            placeholder="e.g. Bank Transfer, Mobile Money, Cash"
            value={m.method}
            onChangeText={(v) => updateNew(i, { method: v })}
          />
          <Spacer size={spacing.xs} />
          <Input
            label="Account / recipient name *"
            placeholder="Full name on the account"
            value={m.account_name}
            onChangeText={(v) => updateNew(i, { account_name: v })}
          />
          <Spacer size={spacing.xs} />
          <Input
            label="Account / wallet number *"
            placeholder="Account number or wallet ID"
            value={m.account_number}
            onChangeText={(v) => updateNew(i, { account_number: v })}
          />
          <Spacer size={spacing.xs} />
          <Input
            label="Bank / provider name (optional)"
            placeholder="e.g. GTBank, Wave"
            value={m.bank_name ?? ''}
            onChangeText={(v) => updateNew(i, { bank_name: v })}
          />
          <Spacer size={spacing.xs} />
          <Input
            label="Additional info (optional)"
            placeholder="Any extra instructions for the buyer"
            value={m.additional_info ?? ''}
            onChangeText={(v) => updateNew(i, { additional_info: v })}
            multiline
          />
        </Card>
      ))}

      <Spacer size={spacing.sm} />
      <Button
        variant="outline"
        size="sm"
        icon={<Plus size={14} color={theme.colors.primary} />}
        onPress={() => onNewMethods([...newMethods, blankMethod()])}
      >
        Add new method
      </Button>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:       { paddingHorizontal: spacing.md },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  accountInfo: { flex: 1 },
  card:        { marginBottom: spacing.sm },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
