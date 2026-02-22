import { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { PublicKey } from '@solana/web3.js'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Card, Header } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { api } from '@/api/client'
import { getBalance } from '@/wallet'
import { toPaymentDisplay, formatSol } from '@/lib/currency'
import type { GigTransaction } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

function TxRow({ tx, userId, solToNgn }: { tx: GigTransaction; userId: string; solToNgn: number }) {
  const { theme } = useUnistyles()
  const isCredit =
    (tx.type === 'release_payment' || tx.type === 'dispute_resolved')
  const sign = isCredit ? '+' : '-'
  const color = isCredit ? theme.colors.success : theme.colors.danger
  const { sol } = toPaymentDisplay(tx.amount_lamports, solToNgn)

  const TYPE_LABEL: Record<string, string> = {
    create_escrow: 'Escrow funded',
    release_payment: 'Payment received',
    cancel_refund: 'Refund received',
    expired_refund: 'Refund (expired)',
    dispute_resolved: 'Dispute resolved',
  }

  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
    : ''

  return (
    <View style={[s.txRow, { borderBottomColor: theme.colors.borderFaint }]}>
      <View style={s.txLeft}>
        <Text weight="medium" size={14}>{TYPE_LABEL[tx.type] ?? tx.type}</Text>
        <Text variant="caption" color={theme.colors.textFaint}>{date}</Text>
      </View>
      <Text weight="semibold" size={15} color={color}>
        {sign}{sol.toFixed(4)} SOL
      </Text>
    </View>
  )
}

export default function WalletScreen() {
  const { theme } = useUnistyles()
  const user = useAuthStore((s) => s.user)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const { postedGigs, workedGigs, fetchAll } = useUserGigsStore()
  const solToNgn = useExchangeRateStore((s) => s.solToNgn)

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<GigTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !walletAddress) return
    load()
  }, [user?.id, walletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setIsLoading(true)
    try {
      // Fetch balance + user gigs in parallel
      const [_, gigsResult] = await Promise.all([
        walletAddress
          ? getBalance(new PublicKey(walletAddress)).then((b) => setBalanceLamports(b))
          : Promise.resolve(),
        user?.id ? fetchAll(user.id) : Promise.resolve(),
      ])

      // Fetch transactions for all gigs
      const allGigs = [...postedGigs, ...workedGigs]
      const uniqueIds = [...new Set(allGigs.map((g) => g.id))]
      const txArrays = await Promise.all(
        uniqueIds.map((id) => api.gigs.transactions({ id }).catch(() => [] as GigTransaction[])),
      )
      const allTx = txArrays
        .flat()
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      setTransactions(allTx)
    } finally {
      setIsLoading(false)
    }
  }

  const balanceSol = balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null

  // Earnings = sum of release_payment + dispute_resolved where user is worker
  const workerGigIds = new Set(workedGigs.map((g) => g.id))
  const earnedLamports = transactions
    .filter((tx) => workerGigIds.has(tx.gig_id) && (tx.type === 'release_payment' || tx.type === 'dispute_resolved'))
    .reduce((sum, tx) => sum + tx.amount_lamports, 0)

  // Spent = sum of create_escrow where user is poster
  const posterGigIds = new Set(postedGigs.map((g) => g.id))
  const spentLamports = transactions
    .filter((tx) => posterGigIds.has(tx.gig_id) && tx.type === 'create_escrow')
    .reduce((sum, tx) => sum + tx.amount_lamports, 0)

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Wallet" showBack />
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Balance card */}
            <Card variant="filled" padding={spacing.lg}>
              <Text variant="caption" color={theme.colors.textSub}>SOL Balance</Text>
              {isLoading || balanceSol === null ? (
                <View style={{ marginTop: 4 }}><Skeleton width={120} height={36} /></View>
              ) : (
                <Text weight="bold" size={32} color={theme.colors.money}>
                  {balanceSol.toFixed(4)} SOL
                </Text>
              )}
              <Text variant="caption" color={theme.colors.textFaint} style={{ marginTop: 4 }}>
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
                  : '—'}
              </Text>
            </Card>

            <Spacer size={spacing.md} />

            {/* Earnings summary */}
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { backgroundColor: theme.colors.successTint }]}>
                <Text variant="caption" color={theme.colors.success} weight="semibold">Earned</Text>
                <Text weight="bold" size={18} color={theme.colors.success}>
                  {formatSol(earnedLamports)}
                </Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: theme.colors.dangerTint }]}>
                <Text variant="caption" color={theme.colors.danger} weight="semibold">Spent</Text>
                <Text weight="bold" size={18} color={theme.colors.danger}>
                  {formatSol(spentLamports)}
                </Text>
              </View>
            </View>

            <Spacer size={spacing.md} />
            <Text variant="subheading">Transaction History</Text>
            <Spacer size={spacing.sm} />
          </>
        }
        renderItem={({ item }) => (
          <TxRow tx={item} userId={user?.id ?? ''} solToNgn={solToNgn} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text variant="caption" color={theme.colors.textFaint} align="center">
              No transactions yet
            </Text>
          ) : null
        }
        ListFooterComponent={<Spacer size={spacing.xl} />}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  txLeft: {
    gap: 2,
  },
})
