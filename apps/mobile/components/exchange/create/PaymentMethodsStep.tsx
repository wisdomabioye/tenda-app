import { useState, useEffect } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Plus, Trash2, Check, CreditCard } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text, Input, Spacer, Button } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
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

export function PaymentMethodsStep({
  selectedAccounts, newMethods, currency,
  onSelectedAccounts, onNewMethods,
}: Props) {
  const { theme } = useUnistyles()
  const [existingAccounts, setExistingAccounts] = useState<UserExchangeAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

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
      <Text style={[s.intro, { color: theme.colors.content.secondary }]}>
        How buyers send {currency} to you.
      </Text>

      {/* Saved accounts */}
      {loadingAccounts ? (
        <ActivityIndicator color={theme.colors.brand.primary} style={s.loader} />
      ) : existingAccounts.length > 0 ? (
        <>
          <SectionLabel>Saved accounts</SectionLabel>
          <View
            style={[
              s.pmList,
              {
                backgroundColor: theme.colors.surface.card,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            {existingAccounts.map((account, i) => {
              const selected = selectedAccounts.some((a) => a.id === account.id)
              const isLast = i === existingAccounts.length - 1
              return (
                <Pressable
                  key={account.id}
                  onPress={() => toggleAccount(account)}
                  style={({ pressed }) => [
                    s.pmRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border.subtle,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      s.pmIcon,
                      {
                        backgroundColor: selected
                          ? theme.colors.brand.primarySurface
                          : theme.colors.surface.inset,
                      },
                    ]}
                  >
                    <CreditCard
                      size={17}
                      color={selected ? theme.colors.brand.primary : theme.colors.content.secondary}
                    />
                  </View>
                  <View style={s.pmBody}>
                    <Text style={[s.pmName, { color: theme.colors.content.primary }]} numberOfLines={1}>
                      {account.method}
                    </Text>
                    <Text style={[s.pmSub, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
                      {account.account_name} · {account.account_number}
                      {account.bank_name ? ` · ${account.bank_name}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.pmCheck,
                      {
                        backgroundColor: selected ? theme.colors.brand.primary : 'transparent',
                        borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default,
                      },
                    ]}
                  >
                    {selected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}

      {/* New methods */}
      {newMethods.length > 0 && <SectionLabel>New methods</SectionLabel>}
      {newMethods.map((m, i) => (
        <View
          key={m._key}
          style={[
            s.newCard,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <View style={s.newCardHead}>
            <Text size={13} weight="semibold" color={theme.colors.content.primary}>
              Method {i + 1}
            </Text>
            <Pressable
              onPress={() => removeNew(i)}
              hitSlop={6}
              style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Remove method"
            >
              <Trash2 size={14} color={theme.colors.feedback.danger.base} />
              <Text size={12} weight="semibold" color={theme.colors.feedback.danger.base}>
                Remove
              </Text>
            </Pressable>
          </View>
          <Spacer size={10} />
          <Input
            label="Method name"
            placeholder="e.g. Bank Transfer, Mobile Money"
            value={m.method}
            onChangeText={(v) => updateNew(i, { method: v })}
          />
          <Spacer size={8} />
          <Input
            label="Account name"
            placeholder="Full name on the account"
            value={m.account_name}
            onChangeText={(v) => updateNew(i, { account_name: v })}
          />
          <Spacer size={8} />
          <Input
            label="Account number"
            placeholder="Account number or wallet ID"
            value={m.account_number}
            onChangeText={(v) => updateNew(i, { account_number: v })}
          />
          <Spacer size={8} />
          <Input
            label="Bank / provider"
            placeholder="e.g. GTBank, Wave"
            value={m.bank_name ?? ''}
            onChangeText={(v) => updateNew(i, { bank_name: v })}
          />
          <Spacer size={8} />
          <Input
            label="Additional info"
            placeholder="Any extra instructions for the buyer"
            value={m.additional_info ?? ''}
            onChangeText={(v) => updateNew(i, { additional_info: v })}
            multiline
          />
        </View>
      ))}

      <View style={s.addWrap}>
        <Button
          variant="outline"
          size="md"
          icon={<Plus size={16} color={theme.colors.brand.primary} />}
          onPress={() => onNewMethods([...newMethods, blankMethod()])}
        >
          Add new method
        </Button>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    paddingBottom: 16,
  },
  intro: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    paddingVertical: 24,
  },
  pmList: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pmRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pmBody: {
    flex: 1,
    minWidth: 0,
  },
  pmName: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.07,
  },
  pmSub: {
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 2,
  },
  pmCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  newCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  newCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addWrap: {
    marginHorizontal: 20,
    marginTop: 12,
  },
})
