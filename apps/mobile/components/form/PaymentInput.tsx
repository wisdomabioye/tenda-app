import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { CURRENCY_META } from '@tenda/shared'
import { MIN_PAYMENT_LAMPORTS, MAX_PAYMENT_LAMPORTS } from '@tenda/shared'
import { formatSolDisplay } from '@/lib/currency'

const LAMPORTS_PER_SOL = 1_000_000_000

interface PaymentInputProps {
  value: number   // lamports
  onChange: (lamports: number) => void
}

type Mode = 'FIAT' | 'SOL'

export function PaymentInput({ value, onChange }: PaymentInputProps) {
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)
  const meta = CURRENCY_META[currency]
  const rate = rates?.[currency] ?? null

  const hasInitialValue = value > 0
  const [mode, setMode] = useState<Mode>(hasInitialValue ? 'SOL' : 'FIAT')
  const [text, setText] = useState(() =>
    hasInitialValue ? (value / LAMPORTS_PER_SOL).toFixed(4) : ''
  )
  const [focused, setFocused] = useState(false)

  const currentSol = value / LAMPORTS_PER_SOL
  const currentFiat = rate != null ? currentSol * rate : null

  const minSol = (MIN_PAYMENT_LAMPORTS / LAMPORTS_PER_SOL).toFixed(4)
  const minFiat = rate != null ? Math.round((MIN_PAYMENT_LAMPORTS / LAMPORTS_PER_SOL) * rate) : null

  function handleChangeText(raw: string) {
    setText(raw)
    const num = parseFloat(raw)
    if (isNaN(num) || num <= 0) return

    let lamports: number
    if (mode === 'FIAT' && rate != null) {
      lamports = Math.round((num / rate) * LAMPORTS_PER_SOL)
    } else {
      lamports = Math.round(num * LAMPORTS_PER_SOL)
    }

    if (lamports > MAX_PAYMENT_LAMPORTS) lamports = MAX_PAYMENT_LAMPORTS
    onChange(lamports)
  }

  function handleModeToggle(next: Mode) {
    setMode(next)
    setText('')
  }

  const equivalent =
    mode === 'FIAT'
      ? `≈ ${formatSolDisplay(currentSol)}`
      : currentFiat != null
        ? `≈ ${currentFiat.toLocaleString(meta.locale, { maximumFractionDigits: 0 })} ${currency}`
        : ''

  const helperText =
    mode === 'FIAT'
      ? minFiat != null
        ? `Min ${meta.symbol}${minFiat.toLocaleString(meta.locale)} (~${minSol} SOL)`
        : `Min ${minSol} SOL`
      : `Min ${minSol} SOL`

  const fiatLabel = rate != null ? currency : `${currency} (loading…)`
  const borderColor = focused ? theme.colors.focusRing : 'transparent'

  return (
    <View style={s.container}>
      <Text variant="label">Payment</Text>

      {/* Toggle */}
      <View style={[s.toggleRow, { backgroundColor: theme.colors.muted }]}>
        {(['FIAT', 'SOL'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => handleModeToggle(m)}
            style={[
              s.toggleBtn,
              mode === m && { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text
              size={13}
              weight="semibold"
              color={mode === m ? theme.colors.primary : theme.colors.textSub}
            >
              {m === 'FIAT' ? fiatLabel : 'SOL'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <View style={[s.inputWrapper, { backgroundColor: theme.colors.input, borderColor }]}>
        <Text size={16} weight="medium" color={theme.colors.textSub} style={s.prefix}>
          {mode === 'FIAT' ? meta.symbol : '◎'}
        </Text>
        <TextInput
          style={[s.input, { color: theme.colors.text }]}
          value={text}
          onChangeText={handleChangeText}
          placeholder={mode === 'FIAT' ? '0' : '0.0000'}
          placeholderTextColor={theme.colors.textFaint}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      {/* Equivalent + helper */}
      {value > 0 && (
        <Text variant="caption" color={theme.colors.textSub}>{equivalent}</Text>
      )}
      <Text variant="caption" color={theme.colors.textFaint}>{helperText}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { gap: 6 },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: radius.md - 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
  },
  prefix: {
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontFamily: 'Manrope_400Regular',
    paddingVertical: 12,
  },
})
