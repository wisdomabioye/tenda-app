import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform, Share, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Share2, Pencil, Lock, AlertTriangle, Building2, Smartphone, Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { spacing, typography } from '@/theme/tokens'
import {
  ScreenContainer,
  Header,
  Text,
  Spacer,
  showToast
} from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatFiat } from '@/lib/currency'
import { 
  LoadingScreen,
  ErrorState,
  TransactionMonitor,
} from '@/components/feedback'
import {
  OfferSummaryCard,
  ExchangeCTABar,
  PaymentWindowBanner,
  useExchangeActions,
} from '@/components/exchange/detail'
import {
  GigProofsGrid,
  ProofViewerModal,
  type ProofItem,
} from '@/components/gig'
import { PersonCard, ReviewsSection } from '@/components/shared'
import {
  useAuthStore,
  usePeerExchangeStore
} from '@/stores'
import { api, ApiClientError } from '@/api/client'
import type { ExchangeOfferDetail, UserExchangeAccount, SupportedCurrency } from '@tenda/shared'

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
        title="Exchange offer"
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

          <PaymentWindowBanner offer={offer} isBuyer={isBuyer} />

          <PersonCard
            label="Seller"
            user={offer.seller}
            currentUserId={userId}
            contextId={offer.id}
            contextTitle={`${offer.fiat_amount.toLocaleString()} ${offer.fiat_currency}`}
            isOffer
            showMessageButton={offer.status !== 'draft'}
          />
          {offer.buyer && (
            <PersonCard
              label="Buyer"
              user={offer.buyer}
              currentUserId={userId}
              contextId={offer.id}
              contextTitle={`${offer.fiat_amount.toLocaleString()} ${offer.fiat_currency}`}
              isOffer
            />
          )}

          {/* Payment methods — context-aware section label */}
          {offer.payment_accounts.length > 0 ? (
            <>
              <SectionLabel>
                {(offer.status === 'accepted' || offer.status === 'paid') && isBuyer
                  ? `Send ${formatFiat(offer.fiat_amount, offer.fiat_currency as SupportedCurrency)} to`
                  : 'Payment methods'}
              </SectionLabel>
              {offer.payment_accounts.map((a) => <AccountCard key={a.id} account={a} />)}
            </>
          ) : isBuyer && offer.status === 'open' ? (
            <>
              <SectionLabel>Payment methods</SectionLabel>
              <View
                style={[
                  s.lockHint,
                  { backgroundColor: theme.colors.surface.inset },
                ]}
              >
                <Lock size={13} color={theme.colors.content.tertiary} />
                <Text style={[s.lockHintText, { color: theme.colors.content.secondary }]}>
                  Accept the offer to see the seller's account details.
                </Text>
              </View>
            </>
          ) : null}

          {offer.proofs.length > 0 && (
            <>
              <SectionLabel>Payment proof</SectionLabel>
              <View style={s.proofsWrap}>
                <GigProofsGrid proofs={offer.proofs} onProofPress={setSelectedProof} />
              </View>
            </>
          )}

          {offer.dispute && (
            <View
              style={[
                s.disputeCard,
                {
                  backgroundColor: theme.colors.feedback.danger.surface,
                  borderColor: theme.colors.feedback.danger.base,
                },
              ]}
            >
              <View style={s.disputeTop}>
                <View style={[s.disputeIc, { backgroundColor: theme.colors.feedback.danger.surface }]}>
                  <AlertTriangle size={16} color={theme.colors.feedback.danger.base} />
                </View>
                <Text style={[s.disputeTitle, { color: theme.colors.feedback.danger.base }]}>
                  Dispute filed
                </Text>
              </View>
              <Text style={[s.disputeBody, { color: theme.colors.content.primary }]}>
                {offer.dispute.reason}
              </Text>
              {offer.dispute.winner && (
                <View style={[s.disputeOutcome, { borderTopColor: theme.colors.feedback.danger.border }]}>
                  <Text style={[s.disputeOutcomeKey, { color: theme.colors.content.secondary }]}>
                    Outcome:
                  </Text>
                  <Text style={[s.disputeOutcomeValue, { color: theme.colors.feedback.success.base }]}>
                    Resolved · Winner {offer.dispute.winner}
                  </Text>
                </View>
              )}
            </View>
          )}

          {offer.reviews.length > 0 && offer.buyer && (
            <ReviewsSection
              reviews={offer.reviews}
              partyAId={offer.seller_id}
              partyA={offer.seller}
              partyALabel="Seller"
              partyB={offer.buyer}
              partyBLabel="Buyer"
              currentUserId={userId}
              title={`Reviews for @${offer.seller.first_name?.toLowerCase() ?? 'seller'}`}
            />
          )}

          <Spacer size={spacing.xl} />
        </ScrollView>

        <ExchangeCTABar
          offer={offer}
          isSeller={isSeller}
          isBuyer={isBuyer}
          currentUserId={userId}
          actions={actions}
        />
      </KeyboardAvoidingView>

      <ProofViewerModal proof={selectedProof} onClose={() => setSelectedProof(null)} />

      {/* Setup account tx (one-time buyer account creation) */}
      <TransactionMonitor
        signature={actions.pendingSetupSignature}
        setupPhase
        onConfirmed={actions.onSetupConfirmed}
        onFailed={(msg) => {
          actions.clearAcceptState()
          showToast('info', msg || 'Account setup failed — please try again')
        }}
      />
      {/* Accept tx */}
      <TransactionMonitor
        signature={actions.pendingAcceptSignature}
        onConfirmed={actions.onAcceptConfirmed}
        onFailed={(msg) => {
          actions.clearAcceptState()
          showToast('info', msg || 'Transaction pending — will sync when confirmed')
        }}
      />
      {/* Main tx monitor — publish, markPaid, confirm, cancel, dispute */}
      <TransactionMonitor
        signature={actions.pendingSignature}
        onConfirmed={actions.onTxConfirmed}
        onFailed={(msg) => {
          actions.clearTxState()
          showToast('info', msg || 'Transaction pending — will sync when confirmed')
        }}
      />
    </ScreenContainer>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountCard({ account }: { account: UserExchangeAccount }) {
  const { theme } = useUnistyles()

  async function copyAccountNumber() {
    await Clipboard.setStringAsync(account.account_number)
    showToast('success', 'Account number copied')
  }

  async function copyHolderName() {
    await Clipboard.setStringAsync(account.account_name)
    showToast('success', 'Account name copied')
  }

  // Pick a method-aware icon — bank-style methods get Building2, mobile money
  // / wallet-style methods get Smartphone. Anything else falls back to Building2.
  const lowerMethod = account.method.toLowerCase()
  const isMobileMoney = /opay|palmpay|kuda|airtel|mtn|m-?pesa|wallet|momo/.test(lowerMethod)
  const Icon = isMobileMoney ? Smartphone : Building2

  // Group digits in fours so long account/phone numbers stay readable:
  //   "0234567891" → "0234 5678 91"
  const groupedNumber = account.account_number.replace(/(.{4})/g, '$1 ').trim()

  const headline = account.bank_name ?? account.method
  const subhead = account.bank_name ? account.method : null

  return (
    <View
      style={[
        s.accountCard,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      {/* Top — icon, headline (bank/method), one-tap holder name copy */}
      <View style={s.accountTop}>
        <View style={[s.accountIc, { backgroundColor: theme.colors.accent.primarySurface }]}>
          <Icon size={17} color={theme.colors.accent.primary} strokeWidth={2.25} />
        </View>
        <View style={s.accountTopBody}>
          <Text style={[s.accountHeadline, { color: theme.colors.content.primary }]} numberOfLines={1}>
            {headline}
          </Text>
          {subhead ? (
            <Text style={[s.accountSubhead, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
              {subhead}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={copyHolderName}
          hitSlop={6}
          style={({ pressed }) => [
            s.accountChip,
            { backgroundColor: theme.colors.surface.inset },
            pressed && { opacity: 0.6 },
          ]}
          accessibilityLabel="Copy account holder name"
        >
          <Text style={[s.accountChipText, { color: theme.colors.content.primary }]} numberOfLines={1}>
            {account.account_name}
          </Text>
        </Pressable>
      </View>

      {/* Account number — the actionable line. Big mono, full digits, prominent
          Copy button. Tappable across the whole row. */}
      <Pressable
        onPress={copyAccountNumber}
        style={({ pressed }) => [
          s.numberRow,
          { backgroundColor: theme.colors.surface.inset },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel="Copy account number"
      >
        <View style={s.numberCol}>
          <Eyebrow>{isMobileMoney ? 'Phone / wallet number' : 'Account number'}</Eyebrow>
          <Text
            style={[s.numberValue, { color: theme.colors.content.primary }]}
            selectable
            numberOfLines={1}
          >
            {groupedNumber}
          </Text>
        </View>
        <View style={[s.copyBtn, { backgroundColor: theme.colors.brand.primary }]}>
          <Copy size={13} color={theme.colors.brand.onPrimary} strokeWidth={2.5} />
          <Text style={[s.copyBtnText, { color: theme.colors.brand.onPrimary }]}>Copy</Text>
        </View>
      </Pressable>

      {/* Optional reference / additional_info — useful for "use your phone number as reference" */}
      {account.additional_info ? (
        <Text style={[s.accountNote, { color: theme.colors.content.tertiary }]} numberOfLines={2}>
          {account.additional_info}
        </Text>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  scroll:      { paddingBottom: spacing['2xl'] },
  // Lock hint
  lockHint: {
    marginHorizontal: 20,
    marginTop: 4,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  lockHintText: {
    fontSize: 12.5,
    flexShrink: 1,
    textAlign: 'center',
  },
  // Account card — full payment-method details (V2 expanded variant)
  accountCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountTopBody: {
    flex: 1,
    minWidth: 0,
  },
  accountHeadline: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.075,
  },
  accountSubhead: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.115,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.mono,
    marginTop: 2,
  },
  accountChip: {
    maxWidth: 140,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  accountChipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.06,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  numberCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  numberValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.18,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexShrink: 0,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.065,
  },
  accountNote: {
    fontSize: 12.5,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  // Proofs
  proofsWrap: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  // Dispute card
  disputeCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  disputeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  disputeIc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disputeTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.16,
  },
  disputeBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  disputeOutcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  disputeOutcomeKey: {
    fontSize: 13,
    fontWeight: '500',
  },
  disputeOutcomeValue: {
    fontSize: 13,
    fontWeight: '700',
  },
})
