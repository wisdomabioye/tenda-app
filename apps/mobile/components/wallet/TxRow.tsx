import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Briefcase, ArrowLeftRight } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { ASSET_META, amountRawToDisplay } from '@tenda/shared'
import type { EscrowTxType, UserEscrowTransaction } from '@tenda/shared'

// Wallet-screen copy per escrow transaction type, flavoured by kind.
const GIG_TYPE_LABEL: Partial<Record<EscrowTxType, string>> = {
  create: 'Gig funded',
  accept: 'Gig accepted',
  decline: 'Assignment declined',
  submit: 'Proof submitted',
  approve: 'Gig payout',
  claim_stalled: 'Payment claimed',
  cancel: 'Refund received',
  refund_expired: 'Refund (expired)',
  reclaim_abandoned: 'Escrow reclaimed',
  dispute: 'Dispute opened',
  resolve: 'Dispute resolved',
}

const EXCHANGE_TYPE_LABEL: Partial<Record<EscrowTxType, string>> = {
  create: 'Exchange escrow',
  accept: 'Offer accepted',
  submit: 'Payment marked',
  approve: 'Crypto released',
  claim_stalled: 'Payment claimed',
  cancel: 'Offer refunded',
  refund_expired: 'Refund (expired)',
  reclaim_abandoned: 'Escrow reclaimed',
  dispute: 'Dispute opened',
  resolve: 'Dispute resolved',
}

/**
 * Direction of value FROM THE VIEWER'S PERSPECTIVE — null for neutral
 * lifecycle rows (accept/submit/dispute carry no transfer to the viewer).
 */
function getTxSign(tx: UserEscrowTransaction, userId: string): '+' | '-' | null {
  const isCreator = tx.escrow.creator_id === userId
  const isCounterparty = tx.escrow.counterparty_id === userId
  switch (tx.type) {
    case 'create':
      return isCreator ? '-' : null
    case 'approve':
    case 'claim_stalled':
      return isCounterparty ? '+' : null
    case 'cancel':
    case 'refund_expired':
    case 'reclaim_abandoned':
      return isCreator ? '+' : null
    case 'resolve': {
      if (!tx.winner) return null
      if (tx.winner === 'split') return '+'
      if (tx.winner === 'counterparty' && isCounterparty) return '+'
      if (tx.winner === 'creator' && isCreator) return '+'
      return null
    }
    default:
      return null
  }
}

interface TxRowProps {
  tx: UserEscrowTransaction
  userId: string
}

export function TxRow({ tx, userId }: TxRowProps) {
  const { theme } = useUnistyles()

  const isGig = tx.escrow.kind === 'gig'
  const Icon = isGig ? Briefcase : ArrowLeftRight
  const iconBg = isGig ? theme.colors.brand.primarySurface : theme.colors.accent.primarySurface
  const iconColor = isGig ? theme.colors.brand.primary : theme.colors.accent.primary

  const sign = getTxSign(tx, userId)
  const amountColor =
    sign === '+'
      ? theme.colors.numeric.positive
      : sign === '-'
        ? theme.colors.numeric.negative
        : theme.colors.content.secondary

  // Row amount: the transaction's own amount when recorded, else the
  // escrow principal (lifecycle rows like accept carry no amount).
  const amountRaw = tx.amount_raw ?? tx.escrow.amount_raw
  const amount = amountRawToDisplay(amountRaw, tx.escrow.asset)
  const symbol = ASSET_META[tx.escrow.asset]?.symbol ?? tx.escrow.asset

  const subtitle = isGig
    ? (GIG_TYPE_LABEL[tx.type] ?? tx.type)
    : (EXCHANGE_TYPE_LABEL[tx.type] ?? tx.type)
  const title = tx.escrow.title ?? (isGig ? 'Gig' : 'Exchange')

  return (
    <View style={[s.row, { borderBottomColor: theme.colors.border.subtle }]}>
      <View style={[s.icon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} />
      </View>

      <View style={s.body}>
        <Text style={[s.title, { color: theme.colors.content.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[s.sub, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {amount > 0 && (
        <View style={s.amt}>
          <Text style={[s.amtMain, { color: amountColor }]} numberOfLines={1}>
            {sign ? `${sign} ` : ''}
            {amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}
          </Text>
          <Text style={[s.amtUnit, { color: theme.colors.content.tertiary }]}>{symbol}</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  sub: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  amt: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  amtMain: {
    fontFamily: typography.fonts.mono,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  amtUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
})
