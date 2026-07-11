import { View, StyleSheet, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Landmark, Smartphone } from 'lucide-react-native'
import type { BankAccountSummary } from '@tenda/shared'
import { Text, Button } from '@/components/ui'

interface Props {
  /** null while loading; [] once loaded-but-empty. */
  accounts: BankAccountSummary[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  /** Navigate to add a payout account (shown only when none exist yet). */
  onAddAccount: () => void
}

/**
 * Selectable list of saved payout accounts (radio semantics) shared by the
 * sell / create-offer flows. Distinct from PayoutAccountRow, which is the
 * delete-oriented management row on the settings screen. When the user has no
 * account yet it collapses to a single "add" affordance.
 */
export function PayoutAccountPicker({ accounts, selectedId, onSelect, onAddAccount }: Props) {
  const { theme } = useUnistyles()

  if (accounts !== null && accounts.length === 0) {
    return (
      <Button variant="outline" size="md" fullWidth onPress={onAddAccount}>
        Add a payout account
      </Button>
    )
  }

  return (
    <View style={s.list}>
      {accounts?.map((a) => {
        const Icon = a.kind === 'mobile_money' ? Smartphone : Landmark
        const selected = selectedId === a.id
        return (
          <Pressable
            key={a.id}
            onPress={() => onSelect(a.id)}
            style={[
              s.row,
              {
                backgroundColor: theme.colors.surface.card,
                borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Icon size={16} color={theme.colors.content.secondary} />
            <View style={s.body}>
              <Text size={13.5} weight="semibold">{a.account_name}</Text>
              <Text size={12} color={theme.colors.content.tertiary}>
                {a.bank_code} · {a.account_number_masked}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  body: { flex: 1, gap: 2 },
})
