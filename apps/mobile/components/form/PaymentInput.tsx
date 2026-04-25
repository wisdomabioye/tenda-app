import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { CURRENCY_META } from '@tenda/shared'
import { MIN_PAYMENT_LAMPORTS, MAX_PAYMENT_LAMPORTS } from '@tenda/shared'
import { formatSolDisplay } from '@/lib/currency'

const LAMPORTS_PER_SOL = 1_000_000_000

interface PaymentInputProps {
  value: number
  onChange: (lamports: number) => void
}

type Mode = 'FIAT' | 'SOL'

/**
 * Budget card per `create-gig.html .budget-card`:
 *   inset 72h R14 with mono 22/700 amount + mono 13 unit suffix + mono 12.5 fiat alt right-aligned.
 *   Adds a small SOL/FIAT mode toggle above (V2 ergonomics — wireframe only shows SOL display).
 */
export function PaymentInput({ value, onChange }: PaymentInputProps) {
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)
  const meta = CURRENCY_META[currency]
  const rate = rates?.[currency] ?? null

  const hasInitial = value > 0
  const [mode, setMode] = useState<Mode>(hasInitial ? 'SOL' : 'FIAT')
  const [text, setText] = useState(() =>
    hasInitial ? (value / LAMPORTS_PER_SOL).toFixed(4) : ''
  )

  const currentSol = value / LAMPORTS_PER_SOL
  const currentFiat = rate != null ? currentSol * rate : null

  const minSol = (MIN_PAYMENT_LAMPORTS / LAMPORTS_PER_SOL).toFixed(4)

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

  function toggleMode(next: Mode) {
    setMode(next)
    setText('')
  }

  const fiatAlt =
    mode === 'SOL' && currentFiat != null
      ? `≈ ${currentFiat.toLocaleString(meta.locale, { maximumFractionDigits: 0 })} ${currency}`
      : mode === 'FIAT' && currentSol > 0
        ? `≈ ${formatSolDisplay(currentSol)}`
        : ''

  const placeholder = mode === 'FIAT' ? meta.symbol + '0' : '0.0000'
  const unitLabel = mode === 'FIAT' ? currency : 'SOL'

  return (
    <View style={s.wrap}>
      <View style={s.modeRow}>
        {(['FIAT', 'SOL'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => toggleMode(m)}
            style={({ pressed }) => [
              s.modeBtn,
              mode === m && { backgroundColor: theme.colors.brand.primarySurface },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              size={11.5}
              weight="semibold"
              color={mode === m ? theme.colors.brand.primary : theme.colors.content.tertiary}
              style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
            >
              {m === 'FIAT' ? currency : 'SOL'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.card, { backgroundColor: theme.colors.surface.inset }]}>
        <Text style={[s.label, { color: theme.colors.content.tertiary }]}>BUDGET</Text>

        <View style={s.row}>
          <TextInput
            value={text}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.content.tertiary}
            keyboardType="decimal-pad"
            style={[
              s.amount,
              { color: text ? theme.colors.content.primary : theme.colors.content.tertiary },
            ]}
            maxFontSizeMultiplier={1}
          />
          <Text style={[s.suffix, { color: theme.colors.content.tertiary }]}>{unitLabel}</Text>
        </View>
        {fiatAlt ? (
          <Text style={[s.fiat, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
            {fiatAlt}
          </Text>
        ) : null}
      </View>

      <Text size={12} color={theme.colors.content.tertiary} style={s.helper}>
        Minimum {minSol} SOL
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    gap: 8,
  },
  modeRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  card: {
    minHeight: 72,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    marginBottom: 4,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  amount: {
    flex: 1,
    minWidth: 0,
    fontFamily: typography.fonts.mono,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.44,
    padding: 0,
  },
  suffix: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.13,
    flexShrink: 0,
  },
  fiat: {
    fontFamily: typography.fonts.mono,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 4,
  },
  helper: {
    paddingHorizontal: 4,
  },
})
