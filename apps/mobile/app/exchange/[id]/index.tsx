import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { SafeAreaView } from 'react-native-safe-area-context'
import { spacing, typography } from '@/theme/tokens'
import { Text, Spacer, Card, Avatar } from '@/components/ui'
import { Header } from '@/components/ui/Header'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { ErrorState } from '@/components/feedback/ErrorState'
import { TransactionMonitor } from '@/components/feedback/TransactionMonitor'
import { OfferSummaryCard } from '@/components/exchange/detail/OfferSummaryCard'
import { ExchangeCTABar } from '@/components/exchange/detail/ExchangeCTABar'
import { useExchangeActions } from '@/components/exchange/detail/useExchangeActions'
import { GigProofsGrid } from '@/components/gig/GigProofsGrid'
import { ProofViewerModal } from '@/components/gig/ProofViewerModal'
import type { ProofItem } from '@/components/gig/ProofViewerModal'
import { showToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/auth.store'
import { usePeerExchangeStore } from '@/stores/p2p-exchange.store'
import { api, ApiClientError } from '@/api/client'
import type { ExchangeOfferDetail, UserExchangeAccount } from '@tenda/shared'

export default function ExchangeDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>()
  const router    = useRouter()
  const userId    = useAuthStore((s) => s.user?.id ?? '')

  const [offer, setOffer]           = useState<ExchangeOfferDetail | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setOffer(await api.exchange.get({ id }))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load offer')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Silent refresh on focus when offer is already loaded; full load on first mount
  useFocusEffect(useCallback(() => { load(offer !== null) }, [id, offer !== null])) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !offer) return <LoadingScreen />
  if (error && !offer)   return <ErrorState title="Could not load offer" description={error} ctaLabel="Retry" onCtaPress={() => load()} />

  return (
    <ExchangeDetailContent
      offer={offer!}
      userId={userId}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(true) }}
      onUpdated={(updated) => {
        setOffer(updated)
        usePeerExchangeStore.getState().fetchOffers()
      }}
      onBack={() => router.back()}
    />
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

interface ContentProps {
  offer:      ExchangeOfferDetail
  userId:     string
  refreshing: boolean
  onRefresh:  () => void
  onUpdated:  (o: ExchangeOfferDetail) => void
  onBack:     () => void
}

function ExchangeDetailContent({ offer, userId, refreshing, onRefresh, onUpdated, onBack }: ContentProps) {
  const { theme } = useUnistyles()
  const actions   = useExchangeActions(offer, onUpdated, onBack)
  const isSeller  = offer.seller_id === userId
  const isBuyer   = offer.buyer_id  === userId
  const [selectedProof, setSelectedProof] = useState<ProofItem | null>(null)

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right']}>
      <Header title="Exchange Offer" showBack />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OfferSummaryCard offer={offer} />

          <PartyRow label="Seller" user={offer.seller} />
          {offer.buyer && <PartyRow label="Buyer" user={offer.buyer} />}

          {offer.payment_accounts.length > 0 && (
            <>
              <Text weight="semibold" size={typography.sizes.sm} style={s.section}>Payment Methods</Text>
              {offer.payment_accounts.map((a) => <AccountCard key={a.id} account={a} />)}
            </>
          )}
          {isBuyer && offer.status === 'open' && (
            <Text variant="caption" color={theme.colors.textSub} style={s.hint}>
              Payment details shown after you accept.
            </Text>
          )}

          {offer.proofs.length > 0 && (
            <>
              <Text weight="semibold" size={typography.sizes.sm} style={s.section}>Payment Proofs</Text>
              <GigProofsGrid proofs={offer.proofs} onProofPress={setSelectedProof} />
            </>
          )}

          {offer.dispute && (
            <Card variant="outlined" padding={spacing.md} style={[s.disputeCard, { borderColor: theme.colors.danger }]}>
              <Text weight="semibold" color={theme.colors.danger}>Dispute</Text>
              <Spacer size={4} />
              <Text size={typography.sizes.sm} color={theme.colors.textSub}>{offer.dispute.reason}</Text>
              {offer.dispute.winner && (
                <Text size={typography.sizes.sm} style={{ marginTop: 4 }}>
                  Winner: <Text weight="semibold">{offer.dispute.winner}</Text>
                </Text>
              )}
            </Card>
          )}

          <Spacer size={spacing.xl} />
        </ScrollView>

        <ExchangeCTABar offer={offer} isSeller={isSeller} isBuyer={isBuyer} actions={actions} />
      </KeyboardAvoidingView>

      <ProofViewerModal proof={selectedProof} onClose={() => setSelectedProof(null)} />

      <TransactionMonitor
        signature={actions.pendingSetupSignature}
        setupPhase
        onConfirmed={actions.onSetupConfirmed}
        onFailed={(msg) => {
          actions.clearAcceptState()
          showToast('info', msg || 'Account setup failed — please try again')
        }}
      />
      <TransactionMonitor
        signature={actions.pendingAcceptSignature}
        onConfirmed={actions.onAcceptConfirmed}
        onFailed={(msg) => {
          actions.clearAcceptState()
          showToast('info', msg || 'Transaction pending — will sync when confirmed')
        }}
      />
    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PartyRow({ label, user }: { label: string; user: ExchangeOfferDetail['seller'] }) {
  const { theme } = useUnistyles()
  const name = `${user.first_name} ${user.last_name}`.trim()
  return (
    <View style={[s.party, { borderBottomColor: theme.colors.borderFaint }]}>
      <Text size={typography.sizes.sm} color={theme.colors.textSub} style={s.partyLabel}>{label}</Text>
      <Avatar src={user.avatar_url} name={name} size="sm" />
      <View style={s.flex}>
        <Text weight="medium" size={typography.sizes.sm}>{name}</Text>
        {user.reputation_score != null && (
          <Text variant="caption" color={theme.colors.textFaint}>★ {user.reputation_score.toFixed(1)}</Text>
        )}
      </View>
    </View>
  )
}

function AccountCard({ account }: { account: UserExchangeAccount }) {
  const { theme } = useUnistyles()
  return (
    <Card variant="outlined" padding={spacing.sm} style={s.accountCard}>
      <Text weight="semibold" size={typography.sizes.sm}>{account.method}</Text>
      <Text variant="caption" color={theme.colors.textSub}>
        {account.account_name} · {account.account_number}
        {account.bank_name ? ` · ${account.bank_name}` : ''}
      </Text>
      {account.additional_info
        ? <Text variant="caption" color={theme.colors.textFaint}>{account.additional_info}</Text>
        : null}
    </Card>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  scroll:      { paddingHorizontal: spacing.md, paddingBottom: spacing['2xl'] },
  section:     { marginTop: spacing.md, marginBottom: spacing.xs },
  hint:        { marginTop: spacing.sm, textAlign: 'center' },
  party:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  partyLabel:  { width: 44 },
  accountCard: { marginBottom: spacing.xs },
  disputeCard: { marginTop: spacing.sm },
})
