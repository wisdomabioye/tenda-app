import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { MIN_PAYMENT_LAMPORTS, MAX_PAYMENT_LAMPORTS } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

interface PaymentInputProps {
  value: number   // lamports
  onChange: (lamports: number) => void
}

type Mode = 'NGN' | 'SOL'

export function PaymentInput({ value, onChange }: PaymentInputProps) {
  const { theme } = useUnistyles()
  const solToNgn = useExchangeRateStore((s) => s.solToNgn)
  const [mode, setMode] = useState<Mode>('NGN')
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const minNgn = Math.round((MIN_PAYMENT_LAMPORTS / LAMPORTS_PER_SOL) * solToNgn)
  const minSol = (MIN_PAYMENT_LAMPORTS / LAMPORTS_PER_SOL).toFixed(4)

  const currentSol = value / LAMPORTS_PER_SOL
  const currentNgn = currentSol * solToNgn

  function handleChangeText(raw: string) {
    setText(raw)
    const num = parseFloat(raw)
    if (isNaN(num) || num <= 0) return

    let lamports: number
    if (mode === 'NGN') {
      lamports = Math.round((num / solToNgn) * LAMPORTS_PER_SOL)
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
    mode === 'NGN'
      ? `≈ ${currentSol.toLocaleString('en-US', { maximumFractionDigits: 4 })} SOL`
      : `≈ ₦${currentNgn.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

  const helperText =
    mode === 'NGN'
      ? `Min ₦${minNgn.toLocaleString('en-NG')} (~${minSol} SOL)`
      : `Min ${minSol} SOL`

  const borderColor = focused ? theme.colors.focusRing : 'transparent'

  return (
    <View style={s.container}>
      <Text variant="label">Payment</Text>

      {/* Toggle */}
      <View style={[s.toggleRow, { backgroundColor: theme.colors.muted }]}>
        {(['NGN', 'SOL'] as Mode[]).map((m) => (
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
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <View style={[s.inputWrapper, { backgroundColor: theme.colors.input, borderColor }]}>
        <Text size={16} weight="medium" color={theme.colors.textSub} style={s.prefix}>
          {mode === 'NGN' ? '₦' : '◎'}
        </Text>
        <TextInput
          style={[s.input, { color: theme.colors.text }]}
          value={text}
          onChangeText={handleChangeText}
          placeholder={mode === 'NGN' ? '0' : '0.0000'}
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
