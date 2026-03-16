import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform, Share, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Share2, Pencil, Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { spacing, typography, radius } from '@/theme/tokens'
import { 
  ScreenContainer,
  Text, 
  Spacer, 
  Card, 
  Avatar,
  Header,
  showToast
} from '@/components/ui'
import { 
  LoadingScreen,
  ErrorState,
  TransactionMonitor,
} from '@/components/feedback'
import { 
  OfferSummaryCard,
  ExchangeCTABar,
  useExchangeActions,
} from '@/components/exchange/detail'
import { 
  GigProofsGrid,
  ProofViewerModal,
  type ProofItem,
} from '@/components/gig'
import { 
  useAuthStore,
  usePeerExchangeStore
} from '@/stores'
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
  const { theme }   = useUnistyles()
  const router      = useRouter()
  const actions     = useExchangeActions(offer, onUpdated, onBack)
  const isSeller    = offer.seller_id === userId
  const isBuyer     = offer.buyer_id  === userId
  const isDraftSeller = isSeller && offer.status === 'draft'
  const [selectedProof, setSelectedProof] = useState<ProofItem | null>(null)

  function handleEdit() {
    router.push(`/exchange/${offer.id}/edit` as never)
  }

  function handleShare() {
    Share.share({ message: `Exchange offer on Tenda — ${offer.fiat_amount.toLocaleString()} ${offer.fiat_currency} for ${Number(offer.lamports_amount) / 1e9} SOL` })
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header
        title="Exchange Offer"
        showBack
        rightIcon={isDraftSeller ? Pencil : Share2}
        onRightPress={isDraftSeller ? handleEdit : handleShare}
      />
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
    </ScreenContainer>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PartyRow({ label, user }: { label: string; user: ExchangeOfferDetail['seller'] }) {
  const { theme } = useUnistyles()
  const name = `${user.first_name} ${user.last_name}`.trim()
  return (
    <View style={[s.party, { borderBottomColor: theme.colors.borderFaint }]}>
      <Avatar src={user.avatar_url} name={name} size="md" />
      <View style={s.flex}>
        <Text weight="medium" size={typography.sizes.sm}>{name}</Text>
        {user.reputation_score != null && (
          <Text variant="caption" color={theme.colors.textFaint}>★ {user.reputation_score.toFixed(1)}</Text>
        )}
      </View>
      <Text variant="caption" color={theme.colors.textSub}>{label}</Text>
    </View>
  )
}

function AccountCard({ account }: { account: UserExchangeAccount }) {
  const { theme } = useUnistyles()

  async function copyAccountNumber() {
    await Clipboard.setStringAsync(account.account_number)
    showToast('success', 'Account number copied')
  }

  return (
    <Card variant="outlined" padding={spacing.md} style={s.accountCard}>

      {/* Method badge + bank name */}
      <View style={s.accountHeader}>
        <View style={[s.methodBadge, { backgroundColor: theme.colors.primaryTint }]}>
          <Text size={typography.sizes.xs} weight="semibold" color={theme.colors.primary}>
            {account.method}
          </Text>
        </View>
        {account.bank_name && (
          <Text variant="caption" color={theme.colors.textSub}>{account.bank_name}</Text>
        )}
      </View>

      <Spacer size={spacing.sm} />

      {/* Account name */}
      <Text variant="caption" color={theme.colors.textFaint}>Account name</Text>
      <Text weight="medium" size={typography.sizes.sm}>{account.account_name}</Text>

      <Spacer size={spacing.sm} />

      {/* Account number — copy row */}
      <Text variant="caption" color={theme.colors.textFaint}>Account number</Text>
      <Pressable style={[s.numberBox, { backgroundColor: theme.colors.surface }]} onPress={copyAccountNumber}>
        <Text weight="semibold" size={typography.sizes.base} style={s.flex}>{account.account_number}</Text>
        <View style={[s.copyBtn, { backgroundColor: theme.colors.muted }]}>
          <Copy size={14} color={theme.colors.primary} />
        </View>
      </Pressable>

      {account.additional_info ? (
        <>
          <Spacer size={spacing.xs} />
          <Text variant="caption" color={theme.colors.textFaint}>{account.additional_info}</Text>
        </>
      ) : null}

    </Card>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  scroll:      { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing['2xl'] },
  section:     { marginTop: spacing.md, marginBottom: spacing.xs },
  hint:        { marginTop: spacing.sm, textAlign: 'center' },
  party:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  partyLabel:  { width: 44 },
  accountCard:   { marginBottom: spacing.sm },
  accountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodBadge:   { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full, alignSelf: 'flex-start' },
  numberBox:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, gap: spacing.xs },
  copyBtn:       { padding: 6, borderRadius: radius.sm },
  disputeCard:   { marginTop: spacing.sm },
})
