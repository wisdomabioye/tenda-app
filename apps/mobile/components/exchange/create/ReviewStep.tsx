import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CreditCard } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { FeeSummary } from '@/components/shared/FeeSummary'
import { CURRENCY_META } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'
import { formatPaymentWindow } from '@/lib/currency'
import type { PaymentMethodFormEntry } from './PaymentMethodsStep'

const LAMPORTS_PER_SOL = 1_000_000_000

interface Props {
  solNum:        number
  fiatNum:       number
  currency:      SupportedCurrency
  rateNum:       number
  windowSeconds: number
  hasDeadline:   boolean
  deadlineInput: string
  methods:       PaymentMethodFormEntry[]
  submitLabel:   string
}

export function ReviewStep({
  solNum, fiatNum, currency, rateNum,
  windowSeconds, hasDeadline, deadlineInput, methods, submitLabel,
}: Props) {
  const { theme } = useUnistyles()
  const meta = CURRENCY_META[currency]

  const deadlineLabel = hasDeadline && deadlineInput
    ? new Date(deadlineInput).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No deadline'

  return (
    <View style={s.wrap}>
      <SectionLabel>Summary</SectionLabel>
      <View
        style={[
          s.summary,
          {
            backgroundColor: theme.colors.surface.card,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        <Text style={[s.eyebrow, { color: theme.colors.content.tertiary }]}>
          OFFER OVERVIEW
        </Text>
        <SummaryRow label="You sell" value={`${solNum} SOL`} mono />
        <SummaryRow label={`Buyer pays`} value={`${meta.symbol}${fiatNum.toLocaleString()} ${currency}`} mono />
        <SummaryRow label="Rate" value={`${meta.symbol}${rateNum.toLocaleString()}/SOL`} mono />
        <SummaryRow label="Pay window" value={formatPaymentWindow(windowSeconds)} />
        <SummaryRow label="Deadline" value={deadlineLabel} />
      </View>

      {solNum > 0 && (
        <>
          <SectionLabel>Fees</SectionLabel>
          <FeeSummary
            principalLamports={Math.round(solNum * LAMPORTS_PER_SOL)}
            eyebrow="YOU WILL ESCROW"
            totalLabel="Total to escrow"
          />
        </>
      )}

      <SectionLabel>Payment methods</SectionLabel>
      <View
        style={[
          s.pmList,
          {
            backgroundColor: theme.colors.surface.card,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        {methods.map((m, i) => {
          const isLast = i === methods.length - 1
          return (
            <View
              key={m._key}
              style={[
                s.pmRow,
                !isLast && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.subtle,
                },
              ]}
            >
              <View style={[s.pmIcon, { backgroundColor: theme.colors.brand.primarySurface }]}>
                <CreditCard size={17} color={theme.colors.brand.primary} />
              </View>
              <View style={s.pmBody}>
                <Text style={[s.pmName, { color: theme.colors.content.primary }]} numberOfLines={1}>
                  {m.method}
                </Text>
                <Text style={[s.pmSub, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
                  {m.account_name} · {m.account_number}
                  {m.bank_name ? ` · ${m.bank_name}` : ''}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      <Text style={[s.note, { color: theme.colors.content.tertiary }]}>
        {submitLabel === 'Save Changes'
          ? 'Your changes will be saved to the draft offer.'
          : 'Your draft will be saved — you can review and publish from the offer page.'}
      </Text>
    </View>
  )
}

interface SummaryRowProps {
  label: string
  value: string
  mono?: boolean
}

function SummaryRow({ label, value, mono = false }: SummaryRowProps) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      <Text size={13.5} color={theme.colors.content.secondary}>{label}</Text>
      <Text
        style={[
          mono ? s.vMono : s.v,
          { color: theme.colors.content.primary },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
  },
  summary: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    marginBottom: 10,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  v: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.07,
  },
  vMono: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.065,
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
  note: {
    paddingHorizontal: 24,
    paddingTop: 12,
    fontSize: 12.5,
    lineHeight: 17,
  },
})
