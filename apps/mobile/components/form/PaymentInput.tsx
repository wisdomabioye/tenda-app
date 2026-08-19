import { useEffect, useRef, useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { MAXIMUM_FONT_SIZE_MULTIPLIER } from '@/theme/accessibility'
import { Text } from '@/components/ui/Text'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  ASSET_META,
  CURRENCY_META,
  gigBudgetFromUnits,
  gigBudgetRangeLabel,
  gigBudgetToRaw,
  gigBudgetToText,
  hasGigBudget,
  sanitizeGigBudgetText,
  sanitizeDecimalText,
  FIAT_ENTRY_DECIMALS,
} from '@tenda/shared'

interface PaymentInputProps {
  /** Asset registry id (CO5), drives decimals, symbol and budget rails. */
  asset: string
  /**
   * Budget in raw units of `asset`, as a base-unit string; '' when unset.
   * A string because an 18-decimal budget is past what a number can hold —
   * see @tenda/shared's gig-budget helpers, which own the conversion.
   */
  value: string
  onChange: (raw: string) => void
}

type Mode = 'FIAT' | 'ASSET'

/**
 * Budget card per `create-gig.html .budget-card`:
 *   inset 72h R14 with mono 22/700 amount + mono 13 unit suffix + mono 12.5 fiat alt right-aligned.
 *   Asset-aware since CO5, the FIAT alt converts via the platform SOL rate
 *   (stables ride the USD leg: NGN-per-USDC ≈ rates.NGN / rates.USD).
 */
export function PaymentInput({ asset, value, onChange }: PaymentInputProps) {
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)
  const currencyMeta = CURRENCY_META[currency]

  const meta = ASSET_META[asset]
  const symbol = meta?.symbol ?? asset

  // Fiat per display unit of `asset`: SOL rates come straight from the
  // platform cache; stables ≈ USD, so divide out the USD leg.
  const solRate = rates?.[currency] ?? null
  const usdRate = rates?.USD ?? null
  const rate =
    meta?.is_stable === true
      ? solRate !== null && usdRate !== null && usdRate > 0
        ? solRate / usdRate
        : null
      : solRate

  const hasInitial = hasGigBudget(value)
  const [mode, setMode] = useState<Mode>(hasInitial ? 'ASSET' : 'FIAT')
  const [text, setText] = useState(() => gigBudgetToText(value, asset))

  // Display magnitude only — safe as a number, and the fiat alt is an
  // approximation by construction ('≈'). The RAW never goes through here.
  const currentUnits = hasInitial ? Number(gigBudgetToText(value, asset)) : 0
  const currentFiat = rate != null ? currentUnits * rate : null

  const rangeDisplay = gigBudgetRangeLabel(asset)

  /**
   * A fiat amount as base units of `asset`. One place, because two callers
   * need it: a keystroke while the rate is known, and the moment the rate
   * arrives for text already on screen.
   */
  function fiatTextToRaw(fiatText: string, fiatPerUnit: number): string {
    // No local finite/zero check: `gigBudgetFromUnits` answers '' for anything
    // non-finite or <= 0, and that is where the rule belongs. A duplicate here
    // read as load-bearing while being unreachable — `sanitizeDecimalText` has
    // already stripped everything that could parse to NaN (measured: 'abc',
    // 'Infinity', '1e5' and '-5' all sanitize to a finite-parsing string).
    return gigBudgetFromUnits(Number(fiatText.replace(/\.$/, '')) / fiatPerUnit, asset)
  }

  /**
   * Convert what is already typed the moment rates ARRIVE.
   *
   * The early return in handleChangeText is correct — converting a fiat number
   * as if it were asset units would misprice by ~1500x — but on its own it only
   * declined to emit. Nothing re-ran once the rate landed, so a budget typed
   * during the rates request stayed on screen with "Set a budget" underneath
   * it: a number shown and not counted, the same dishonesty #32 removed for a
   * trailing decimal point.
   *
   * Only on the null→rate TRANSITION, tracked through a ref. Re-converting on
   * every rate tick would move a budget the reader had already set, under them.
   *
   * The transition CAN fire more than once a session: the store never nulls
   * `rates` once loaded, but the derived `rate` goes null if the reader switches
   * to a currency not yet cached, and back when that rate lands.
   *
   * WHICH MAKES A CURRENCY SWITCH TWO DIFFERENT BEHAVIOURS, and this note used
   * to claim only the good one. Switching to an UNCACHED currency passes through
   * null, so the text is re-converted at the new rate; switching to a CACHED one
   * never passes through null, so nothing re-runs and the emitted raw stays the
   * OLD currency's valuation while the unit suffix already reads the new one
   * (reproduced in the #49 re-audit: NGN->KES with both cached emits nothing,
   * leaving 150000 on screen under a KES suffix against a budget of 100 USDC
   * rather than 1000). Same action, two answers, decided by cache state.
   *
   * Not repaired here because the right behaviour is a product choice — re-price
   * the typed number, restate the same budget in the new currency, or clear it —
   * and picking one inside an audit would be guessing. Tracked as #66.
   */
  const lastRateRef = useRef(rate)
  useEffect(() => {
    const previous = lastRateRef.current
    lastRateRef.current = rate
    const ratesJustArrived = (previous == null || previous <= 0) && rate != null && rate > 0
    if (!ratesJustArrived || mode !== 'FIAT') return
    // An empty field needs no guard of its own: `gigBudgetFromUnits` answers
    // '' for anything <= 0, so there is nothing to emit and nothing to clear.
    const raw = fiatTextToRaw(text, rate)
    if (raw !== '') onChange(raw)
    // `text`/`mode` are read, not watched: an edit re-enters handleChangeText,
    // which converts directly. This effect exists for the rate edge alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate])

  function handleChangeText(typed: string) {
    // In ASSET mode the field IS the amount, so it is precision-limited at
    // entry. In FIAT mode it is a fiat amount that happens to share the
    // widget — the asset's decimals say nothing about how many kobo a reader
    // may type, so only the character filter applies.
    const next =
      mode === 'ASSET'
        ? sanitizeGigBudgetText(typed, asset)
        : sanitizeDecimalText(typed, FIAT_ENTRY_DECIMALS)
    setText(next)

    if (mode === 'ASSET') {
      onChange(gigBudgetToRaw(next, asset))
      return
    }

    // No rate yet → a FIAT entry can't convert; emitting it as ASSET units
    // would misprice by orders of magnitude. Wait for the rate (the toggle
    // to the asset tab always works).
    if (rate == null || rate <= 0) return
    onChange(fiatTextToRaw(next, rate))
  }

  function toggleMode(next: Mode) {
    setMode(next)
    setText('')
    // The cleared field is a cleared budget. Leaving the old raw behind let
    // the step stay satisfied by a number that was no longer on screen.
    onChange('')
  }

  const fiatAlt =
    mode === 'ASSET' && currentFiat != null
      ? `≈ ${currentFiat.toLocaleString(currencyMeta.locale, { maximumFractionDigits: 0 })} ${currency}`
      : mode === 'FIAT' && currentUnits > 0
        ? `≈ ${currentUnits.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`
        : ''

  const placeholder = mode === 'FIAT' ? currencyMeta.symbol + '0' : '0.00'
  const unitLabel = mode === 'FIAT' ? currency : symbol

  return (
    <View style={s.wrap}>
      <View style={s.modeRow}>
        {(['FIAT', 'ASSET'] as Mode[]).map((m) => (
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
              {m === 'FIAT' ? currency : symbol}
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
            maxFontSizeMultiplier={MAXIMUM_FONT_SIZE_MULTIPLIER}
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
        Budget {rangeDisplay}
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
