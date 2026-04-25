import { useState } from 'react'
import { View, Pressable, TextInput, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ChevronDown, Check } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text, BottomSheet } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { SUPPORTED_CURRENCIES, CURRENCY_META } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

interface Props {
  solInput:     string
  fiatInput:    string
  currency:     SupportedCurrency
  rateInput:    string
  onSolChange:  (v: string) => void
  onFiatChange: (v: string) => void
  onCurrency:   (c: SupportedCurrency) => void
  onRateChange: (v: string) => void
}

export function OfferDetailsStep({
  solInput, fiatInput, currency, rateInput,
  onSolChange, onFiatChange, onCurrency, onRateChange,
}: Props) {
  const { theme } = useUnistyles()
  const meta = CURRENCY_META[currency]
  const rates = useExchangeRateStore((s) => s.rates)
  const marketRate = rates?.[currency] ?? null

  const [pickerOpen, setPickerOpen] = useState(false)
  const [solFocus, setSolFocus]   = useState(false)
  const [fiatFocus, setFiatFocus] = useState(false)

  function handleSolChange(v: string) {
    onSolChange(v)
    const sol  = parseFloat(v) || 0
    const fiat = parseFloat(fiatInput) || 0
    if (sol > 0 && fiat > 0) onRateChange(String(Math.round(fiat / sol)))
  }

  function handleFiatChange(v: string) {
    onFiatChange(v)
    const sol  = parseFloat(solInput) || 0
    const fiat = parseFloat(v) || 0
    if (sol > 0 && fiat > 0) onRateChange(String(Math.round(fiat / sol)))
  }

  function handleUseMarketRate() {
    if (marketRate == null) return
    const sol = parseFloat(solInput) || 0
    onRateChange(String(Math.round(marketRate)))
    if (sol > 0) onFiatChange(String(Math.round(sol * marketRate)))
  }

  const userRate = parseFloat(rateInput) || 0
  const spreadPct = marketRate && userRate > 0
    ? ((userRate - marketRate) / marketRate) * 100
    : null

  let spreadLabel = ''
  let spreadColor = theme.colors.content.tertiary
  if (spreadPct != null) {
    const abs = Math.abs(spreadPct).toFixed(1)
    if (spreadPct > 0.5) {
      spreadLabel = `+${abs}% above market`
      spreadColor = theme.colors.feedback.success.base
    } else if (spreadPct < -0.5) {
      spreadLabel = `−${abs}% below market`
      spreadColor = theme.colors.feedback.danger.base
    } else {
      spreadLabel = 'At market rate'
      spreadColor = theme.colors.content.secondary
    }
  }

  return (
    <View style={s.wrap}>
      {/* Currency picker */}
      <SectionLabel>Receive in</SectionLabel>
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          s.currencyRow,
          {
            backgroundColor: theme.colors.surface.card,
            borderColor: theme.colors.border.default,
          },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
      >
        <View style={[s.flag, { backgroundColor: theme.colors.brand.primarySurface }]}>
          <Text style={[s.flagText, { color: theme.colors.brand.primary }]}>{currency}</Text>
        </View>
        <View style={s.currencyMeta}>
          <Eyebrow style={{ marginBottom: 2 }}>RECEIVE IN</Eyebrow>
          <Text style={[s.currencyVal, { color: theme.colors.content.primary }]}>
            {currency} · {meta.locale}
          </Text>
        </View>
        <ChevronDown size={16} color={theme.colors.content.tertiary} />
      </Pressable>

      {/* Leg cards */}
      <SectionLabel>Amount</SectionLabel>
      <LegCard
        eyebrow="YOU SELL"
        value={solInput}
        suffix="SOL"
        placeholder="0.00"
        onChange={handleSolChange}
        focused={solFocus}
        onFocus={() => setSolFocus(true)}
        onBlur={() => setSolFocus(false)}
      />
      <View style={s.legGap} />
      <LegCard
        eyebrow="BUYER PAYS"
        value={fiatInput}
        suffix={currency}
        placeholder={`${meta.symbol}0`}
        onChange={handleFiatChange}
        focused={fiatFocus}
        onFocus={() => setFiatFocus(true)}
        onBlur={() => setFiatFocus(false)}
      />

      {/* Rate panel */}
      <SectionLabel>Your rate</SectionLabel>
      <View
        style={[
          s.ratePanel,
          {
            backgroundColor: theme.colors.surface.card,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        <View style={s.rateRow}>
          <Text size={13.5} color={theme.colors.content.secondary}>You ask</Text>
          <Text style={[s.rateValue, { color: theme.colors.content.primary }]}>
            {meta.symbol}{userRate ? userRate.toLocaleString(meta.locale) : '—'}
            <Text style={[s.rateUnit, { color: theme.colors.content.tertiary }]}>
              {' / SOL'}
            </Text>
          </Text>
        </View>

        {marketRate != null && (
          <View style={s.rateRow}>
            <Text size={13.5} color={theme.colors.content.secondary}>Market</Text>
            <Text style={[s.rateValue, { color: theme.colors.content.tertiary }]}>
              {meta.symbol}{Math.round(marketRate).toLocaleString(meta.locale)}
              <Text style={[s.rateUnit, { color: theme.colors.content.tertiary }]}>
                {' / SOL'}
              </Text>
            </Text>
          </View>
        )}

        {spreadLabel ? (
          <View
            style={[
              s.rateRow,
              s.spreadRow,
              { borderTopColor: theme.colors.border.subtle },
            ]}
          >
            <Text size={12.5} color={theme.colors.content.tertiary}>Spread</Text>
            <Text style={[s.spreadLabel, { color: spreadColor }]}>{spreadLabel}</Text>
          </View>
        ) : null}

        {marketRate != null && spreadPct != null && Math.abs(spreadPct) > 0.5 && (
          <Pressable
            onPress={handleUseMarketRate}
            style={({ pressed }) => [
              s.useMarket,
              { backgroundColor: theme.colors.brand.primarySurface },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel="Use market rate"
            accessibilityRole="button"
          >
            <Text size={12.5} weight="semibold" color={theme.colors.brand.primary}>
              Match market rate
            </Text>
          </Pressable>
        )}
      </View>
      <Text style={[s.helper, { color: theme.colors.content.tertiary }]}>
        Rate is calculated from the amounts above. Adjust either to change it.
      </Text>

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Receive in"
      >
        {SUPPORTED_CURRENCIES.map((cur) => {
          const selected = currency === cur
          return (
            <Pressable
              key={cur}
              onPress={() => {
                onCurrency(cur)
                setPickerOpen(false)
              }}
              style={({ pressed }) => [
                s.pickerRow,
                { borderBottomColor: theme.colors.border.subtle },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
            >
              <Text
                size={15}
                weight={selected ? 'semibold' : 'regular'}
                color={selected ? theme.colors.brand.primary : theme.colors.content.primary}
              >
                {cur}
              </Text>
              {selected && <Check size={16} color={theme.colors.brand.primary} />}
            </Pressable>
          )
        })}
      </BottomSheet>
    </View>
  )
}

interface LegCardProps {
  eyebrow: string
  value: string
  suffix: string
  placeholder: string
  onChange: (v: string) => void
  focused: boolean
  onFocus: () => void
  onBlur: () => void
}

function LegCard({ eyebrow, value, suffix, placeholder, onChange, focused, onFocus, onBlur }: LegCardProps) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        ls.card,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: focused ? theme.colors.brand.primary : theme.colors.border.default,
        },
      ]}
    >
      <Eyebrow style={{ marginBottom: 4 }}>{eyebrow}</Eyebrow>
      <View style={ls.row}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.content.tertiary}
          keyboardType="decimal-pad"
          maxFontSizeMultiplier={1}
          onFocus={onFocus}
          onBlur={onBlur}
          style={[
            ls.val,
            { color: value ? theme.colors.content.primary : theme.colors.content.tertiary },
          ]}
        />
        <Text style={[ls.suf, { color: theme.colors.content.tertiary }]}>{suffix}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    paddingBottom: 16,
  },
  currencyRow: {
    marginHorizontal: 20,
    height: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: {
    width: 44,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  currencyMeta: {
    flex: 1,
    minWidth: 0,
  },
  currencyVal: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  legGap: { height: 10 },
  ratePanel: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  rateValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.07,
  },
  rateUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.06,
  },
  spreadRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  spreadLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.063,
  },
  useMarket: {
    marginTop: 10,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  helper: {
    marginHorizontal: 20,
    marginTop: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
})

const ls = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  val: {
    flex: 1,
    minWidth: 0,
    fontFamily: typography.fonts.mono,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.52,
    padding: 0,
  },
  suf: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.13,
  },
})
