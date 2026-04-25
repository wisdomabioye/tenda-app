import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Briefcase, ArrowLeftRight } from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import type { UserTransaction } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

const GIG_TYPE_LABEL: Record<string, string> = {
  create_escrow:    'Gig funded',
  accept_gig:       'Gig accepted',
  release_payment:  'Gig payout',
  cancel_refund:    'Refund received',
  expired_refund:   'Refund (expired)',
  dispute_resolved: 'Dispute resolved',
}

const EXCHANGE_TYPE_LABEL: Record<string, string> = {
  create_escrow:    'Exchange escrow',
  accept:           'Offer accepted',
  mark_paid:        'Payment marked',
  release_payment:  'SOL released',
  cancel_refund:    'Offer refunded',
  expired_refund:   'Refund (expired)',
  dispute_raised:   'Dispute opened',
  dispute_resolved: 'Dispute resolved',
}

function formatSolShort(sol: number): string {
  return sol >= 1 ? sol.toFixed(2) : sol.toFixed(3)
}

function formatFiatShort(amount: number, currency: string): string {
  const symbol: Record<string, string> = { NGN: '₦', USD: '$', GHS: '₵', KES: 'KSh', ZAR: 'R' }
  const sym = symbol[currency] ?? `${currency} `
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `${sym}${Math.round(amount / 1_000)}k`
  return `${sym}${Math.round(amount)}`
}

function getTxSign(tx: UserTransaction, userId: string): '+' | '-' | null {
  if (tx.source === 'gig') {
    const isWorker = tx.gig.worker_id === userId
    const isPoster = tx.gig.poster_id === userId
    switch (tx.type) {
      case 'create_escrow':    return isPoster ? '-' : null
      case 'release_payment':  return isWorker ? '+' : null
      case 'cancel_refund':
      case 'expired_refund':   return isPoster ? '+' : null
      case 'dispute_resolved': {
        if (!tx.winner) return null
        if (tx.winner === 'split') return '+'
        if (tx.winner === 'worker' && isWorker) return '+'
        if (tx.winner === 'poster' && isPoster) return '+'
        return null
      }
      default: return null
    }
  } else {
    const isSeller = tx.offer.seller_id === userId
    const isBuyer  = tx.offer.buyer_id  === userId
    switch (tx.type) {
      case 'create_escrow':    return isSeller ? '-' : null
      case 'release_payment':  return isBuyer  ? '+' : null
      case 'cancel_refund':
      case 'expired_refund':   return isSeller ? '+' : null
      case 'dispute_resolved': {
        if (!tx.winner) return null
        if (tx.winner === 'split') return '+'
        if (tx.winner === 'seller' && isSeller) return '+'
        if (tx.winner === 'buyer'  && isBuyer)  return '+'
        return null
      }
      default: return null
    }
  }
}

interface TxRowProps {
  tx: UserTransaction
  userId: string
}

export function TxRow({ tx, userId }: TxRowProps) {
  const { theme } = useUnistyles()

  const isGig = tx.source === 'gig'
  const Icon = isGig ? Briefcase : ArrowLeftRight
  const iconBg = isGig ? theme.colors.brand.primarySurface : theme.colors.accent.primarySurface
  const iconColor = isGig ? theme.colors.brand.primary : theme.colors.accent.primary

  const sign = getTxSign(tx, userId)
  const amountColor = sign === '+'
    ? theme.colors.numeric.positive
    : sign === '-'
      ? theme.colors.numeric.negative
      : theme.colors.content.secondary

  const sol = tx.amount_lamports / LAMPORTS_PER_SOL
  const subtitle = isGig
    ? (GIG_TYPE_LABEL[tx.type] ?? tx.type)
    : (EXCHANGE_TYPE_LABEL[tx.type] ?? tx.type)
  const title = isGig
    ? tx.gig.title
    : `${formatSolShort(Number(tx.offer.lamports_amount) / LAMPORTS_PER_SOL)} SOL → ${formatFiatShort(tx.offer.fiat_amount, tx.offer.fiat_currency)}`

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

      {sol > 0 && (
        <View style={s.amt}>
          <Text style={[s.amtMain, { color: amountColor }]} numberOfLines={1}>
            {sign ? `${sign} ` : ''}{sol.toFixed(4)}
          </Text>
          <Text style={[s.amtUnit, { color: theme.colors.content.tertiary }]}>SOL</Text>
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
