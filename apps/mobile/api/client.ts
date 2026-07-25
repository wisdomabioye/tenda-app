import {
  apiRoutes,
  type User,
  type UpdateUserInput,
  type PublicUser,
  type GigSummary,
  type GigDetail,
  type GigListQuery,
  type CreateGigDetailsBody,
  type GigDetailsRow,
  type PaginatedResponse,
  type CloudinarySignature,
  type UploadSignatureBody,
  type Review,
  type ReviewInput,
  type GetUserReviewsQuery,
  type PlatformConfig,
  type ExchangeRates,
  type ChainRegistryEntry,
  type Conversation,
  type Message,
  type SendMessageInput,
  type MessagesQuery,
  type GigSubscription,
  type UpsertSubscriptionInput,
  type RegisterDeviceTokenInput,
  type NotificationFeed,
  type NotificationsQuery,
  type CreateReportInput,
  type ExchangeSummary,
  type ExchangeDetail,
  type ExchangeListQuery,
  type CreateExchangeDetailsBody,
  type ExchangeDetailsRow,
  type EscrowListRow,
  type EscrowProof,
  type DisputeMessage,
  type DisputeThreadResponse,
  type SendDisputeMessageBody,
  type MyDisputeRow,
  type MyDisputesQuery,
  type UserEscrowsQuery,
  type UserEscrowTransaction,
  type UserTransactionsSummary,
  type UserTransactionsQuery,
  type AuthNonceResponse,
  type ChallengeBody,
  type ChallengeResponse,
  type VerifyBody,
  type VerifyResponse,
  type LoginMethodsResponse,
  type LinkWalletBody,
  type LinkWalletResponse,
  type WalletRefBody,
  type UnlinkWalletResponse,
  type SetPrimaryWalletResponse,
  type MeResponse,
  type UpdateMeInput,
  type UpdateMeResponse,
  type MyStandingResponse,
  type UserStandingResponse,
  type ModerationPreviewBody,
  type ModerationPreviewResponse,
  type FiatQuoteBody,
  type FiatQuoteResponse,
  type FiatInitiateBody,
  type FiatOfframpInitiateBody,
  type FiatInitiateResponse,
  type FiatIntentDetail,
  type BankAccountSummary,
  type CreateBankAccountBody,
  type CreateEscrowApiBody,
  type CreateEscrowApiResponse,
  type EscrowActionResponse,
  type SubmitEscrowProofBody,
  type AddEscrowProofsBody,
  type DisputeEscrowApiBody,
  type ResolveEscrowApiBody,
  type ClientPingBody,
  type PermitPayloadBody,
  type PermitPayloadResponse,
  type ClientPingResponse,
} from '@tenda/shared'
import { request, ApiClientError } from './request'

export { ApiClientError }

const {
  auth,
  escrows,
  disputes,
  gigs,
  users,
  upload,
  blockchain,
  platform,
  conversations,
  notifications,
  subscriptions,
  reports,
  exchange,
  moderation,
  fiat,
} = apiRoutes

/**
 * Timeout budget (ms) for endpoints that synchronously run the moderation LLM.
 * The server's worst case is two OpenRouter calls (content + low-confidence
 * escalation) at `moderationConfig.timeoutMs` each; this must sit above that
 * plus network overhead, well clear of the global 5s dev default that
 * otherwise aborts gig creation mid-moderation (raw "Aborted", wallet never
 * opens). Keep in sync with the server moderation budget.
 */
const MODERATION_TIMEOUT_MS = 20_000

/**
 * Timeout budget (ms) for tx-build endpoints that make live EVM RPC reads
 * server-side: dispute (readEscrow) and permit-payload (name/nonces/
 * DOMAIN_SEPARATOR). The server's viem transport waits up to 15s per RPC
 * attempt (DEFAULT_EVM_RPC_TIMEOUT_MS), so the global 5s dev default aborts
 * the request while the server is still waiting on a slow RPC (raw
 * "Aborted", wallet never opens). Keep above the server RPC timeout.
 */
const TX_BUILD_TIMEOUT_MS = 20_000

export const api = {
  auth: {
    nonce: () => request<AuthNonceResponse>('POST', auth.nonce),
    /**
     * Stage 9 unified, issue an OTP (phone/email). Wallet/OAuth challenge
     * off-device. The bearer is the server's link/sign-in discriminator, so it
     * is sent ONLY with `link: true`; sign-in stays anonymous even when a
     * (possibly stale) JWT is stored.
     */
    challenge: (body: ChallengeBody, opts?: { link?: boolean }) =>
      request<ChallengeResponse>('POST', auth.challenge, { body, auth: opts?.link === true }),
    /**
     * Stage 9 unified, verify a proof → { token, user, is_new }. Anonymous by
     * default (LOGS IN / creates); pass `link: true` to attach the bearer and
     * LINK the identity to the current account instead. Never auto-attaches
     * the stored JWT: a dead token on the sign-in path would 401 every retry.
     */
    verify: (body: VerifyBody, opts?: { link?: boolean }) =>
      request<VerifyResponse>('POST', auth.verify, { body, auth: opts?.link === true }),
    me: () => request<User>('GET', auth.me),
    /** Stage 9, the caller's non-wallet sign-in identities (Sign-in & security). */
    methods: () => request<LoginMethodsResponse>('GET', auth.methods),
    linkWallet: (body: LinkWalletBody) =>
      request<LinkWalletResponse>('POST', auth.linkWallet, { body }),
    unlinkWallet: (body: WalletRefBody) =>
      request<UnlinkWalletResponse>('POST', auth.unlinkWallet, { body }),
    setPrimaryWallet: (body: WalletRefBody) =>
      request<SetPrimaryWalletResponse>('POST', auth.setPrimaryWallet, { body }),
  },

  // v2 escrow primitive, every on-chain action returns an unsigned tx the
  // wallet signs; the broadcast result is reported via blockchain.clientPing.
  // proofs/review are off-chain satellites.
  escrows: {
    create: (body: CreateEscrowApiBody) =>
      request<CreateEscrowApiResponse>('POST', escrows.create, { body }),
    // Publish path for drafts that never got (or lost) their unsigned tx.
    buildCreate: (params: { id: string }) =>
      request<CreateEscrowApiResponse>('POST', escrows.buildCreate, { params }),
    accept: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.accept, { params }),
    decline: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.decline, { params }),
    submit: (params: { id: string }, body: SubmitEscrowProofBody) =>
      request<EscrowActionResponse>('POST', escrows.submit, { params, body }),
    approve: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.approve, { params }),
    claim: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.claim, { params }),
    cancel: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.cancel, { params }),
    refund: (params: { id: string }) =>
      request<EscrowActionResponse>('POST', escrows.refund, { params }),
    // Dispute is the one escrow transition whose EVM buildTx reads on-chain
    // state (the bond's asset), so it inherits the RPC timeout budget.
    dispute: (params: { id: string }, body: DisputeEscrowApiBody) =>
      request<EscrowActionResponse>('POST', escrows.dispute, {
        params,
        body,
        timeout: TX_BUILD_TIMEOUT_MS,
      }),
    // CO7 mediation thread, one shared conversation per dispute.
    disputeThread: (params: { id: string }, query?: { after?: string }) =>
      request<DisputeThreadResponse>('GET', escrows.disputeMessages, { params, query }),
    sendDisputeMessage: (params: { id: string }, body: SendDisputeMessageBody) =>
      request<DisputeMessage>('POST', escrows.sendDisputeMessage, { params, body }),
    resolve: (params: { id: string }, body: ResolveEscrowApiBody) =>
      request<EscrowActionResponse>('POST', escrows.resolve, { params, body }),
    delete: (params: { id: string }) =>
      request<{ deleted: true }>('DELETE', escrows.delete, { params }),
    proofs: (params: { id: string }) =>
      request<EscrowProof[]>('GET', escrows.proofs, { params }),
    addProofs: (params: { id: string }, body: AddEscrowProofsBody) =>
      request<EscrowProof[]>('POST', escrows.addProofs, { params, body }),
    review: (params: { id: string }, body: ReviewInput) =>
      request<Review>('POST', escrows.review, { params, body }),
  },

  // Party-facing dispute list (the caller's own disputes) — keeps a dispute
  // findable after its push notification is dismissed.
  disputes: {
    mine: (query?: MyDisputesQuery) =>
      request<PaginatedResponse<MyDisputeRow>>('GET', disputes.mine, {
        query: query as Record<string, unknown>,
      }),
  },

  // Browse surfaces (escrows ⨝ details server-side) + the create-detail
  // satellite (create flow step 2, step 1 is escrows.create).
  gigs: {
    featured: () => request<{ data: GigSummary[] }>('GET', gigs.featured),
    list: (query?: GigListQuery) =>
      request<PaginatedResponse<GigSummary>>('GET', gigs.list, {
        query: query as Record<string, unknown>,
      }),
    create: (body: CreateGigDetailsBody) =>
      request<GigDetailsRow>('POST', gigs.create, { body, timeout: MODERATION_TIMEOUT_MS }),
    get: (params: { id: string }) => request<GigDetail>('GET', gigs.get, { params }),
  },

  exchange: {
    list: (query?: ExchangeListQuery) =>
      request<PaginatedResponse<ExchangeSummary>>('GET', exchange.list, {
        query: query as Record<string, unknown>,
      }),
    // CO4: attach offer terms to a draft escrow (create flow step 2).
    create: (body: CreateExchangeDetailsBody) =>
      request<ExchangeDetailsRow>('POST', exchange.create, { body }),
    get: (params: { id: string }) => request<ExchangeDetail>('GET', exchange.get, { params }),
  },

  users: {
    me: () => request<MeResponse>('GET', users.me),
    updateMe: (body: UpdateMeInput) =>
      request<UpdateMeResponse>('PATCH', users.updateMe, { body }),
    myStanding: () => request<MyStandingResponse>('GET', users.myStanding),
    standing: (params: { id: string }) =>
      request<UserStandingResponse>('GET', users.standing, { params }),
    get: (params: { id: string }) => request<PublicUser>('GET', users.get, { params }),
    update: (params: { id: string }, body: UpdateUserInput) =>
      request<User>('PATCH', users.update, { params, body }),
    escrows: (params: { id: string }, query?: UserEscrowsQuery) =>
      request<PaginatedResponse<EscrowListRow>>('GET', users.escrows, {
        params,
        query: query as Record<string, unknown>,
      }),
    reviews: (params: { id: string }, query?: GetUserReviewsQuery) =>
      request<PaginatedResponse<Review>>('GET', users.reviews, {
        params,
        query: query as Record<string, unknown>,
      }),
    transactions: (params: { id: string }, query?: UserTransactionsQuery) =>
      request<PaginatedResponse<UserEscrowTransaction>>('GET', users.transactions, {
        params,
        query: query as Record<string, unknown>,
      }),
    // Lifetime USDC totals as a server-side aggregate — deliberately NOT
    // derived from the paginated feed above (open_issues MB1).
    transactionsSummary: (params: { id: string }) =>
      request<UserTransactionsSummary>('GET', users.transactionsSummary, { params }),
  },

  upload: {
    signature: (body: UploadSignatureBody) =>
      request<CloudinarySignature>('POST', upload.signature, { body }),
  },

  moderation: {
    preview: (body: ModerationPreviewBody) =>
      request<ModerationPreviewResponse>('POST', moderation.preview, { body, timeout: MODERATION_TIMEOUT_MS }),
  },

  fiat: {
    quote: (body: FiatQuoteBody) => request<FiatQuoteResponse>('POST', fiat.quote, { body }),
    onramp: (body: FiatInitiateBody) =>
      request<FiatInitiateResponse>('POST', fiat.onramp, { body }),
    offramp: (body: FiatOfframpInitiateBody) =>
      request<FiatInitiateResponse>('POST', fiat.offramp, { body }),
    intent: (params: { id: string }) => request<FiatIntentDetail>('GET', fiat.intent, { params }),
    cancelIntent: (params: { id: string }) =>
      request<{ cancelled: true }>('POST', fiat.cancelIntent, { params }),
    bankAccounts: () => request<BankAccountSummary[]>('GET', fiat.bankAccounts),
    createBankAccount: (body: CreateBankAccountBody) =>
      request<BankAccountSummary>('POST', fiat.createBankAccount, { body }),
    deleteBankAccount: (params: { id: string }) =>
      request<{ deleted: true }>('DELETE', fiat.deleteBankAccount, { params }),
  },

  blockchain: {
    clientPing: (body: ClientPingBody) =>
      request<ClientPingResponse>('POST', blockchain.clientPing, { body }),
    // EIP-2612: server-built typed data for eth_signTypedData_v4. Reads
    // name/nonces/DOMAIN_SEPARATOR off the token live → RPC timeout budget.
    permitPayload: (body: PermitPayloadBody) =>
      request<PermitPayloadResponse>('POST', blockchain.permitPayload, {
        body,
        timeout: TX_BUILD_TIMEOUT_MS,
      }),
  },

  platform: {
    config: () => request<PlatformConfig>('GET', platform.config),
    exchangeRates: () => request<ExchangeRates>('GET', platform.exchangeRates),
    // CO5: enabled chains + assets (chain/asset picker source).
    chains: () => request<{ data: ChainRegistryEntry[] }>('GET', platform.chains),
  },

  conversations: {
    list: () => request<Conversation[]>('GET', conversations.list),
    findOrCreate: (body: { user_id: string }) =>
      request<Conversation>('POST', conversations.findOrCreate, { body }),
    messages: (params: { id: string }, query?: MessagesQuery) =>
      request<Message[]>('GET', conversations.messages, {
        params,
        query: query as Record<string, unknown>,
      }),
    sendMessage: (params: { id: string }, body: SendMessageInput) =>
      request<Message>('POST', conversations.sendMessage, { params, body }),
    close: (params: { id: string }) =>
      request<Conversation>('POST', conversations.close, { params }),
  },

  notifications: {
    registerToken: (body: RegisterDeviceTokenInput) =>
      request<{ ok: boolean }>('POST', notifications.registerToken, { body }),
    removeToken: (body: { token: string }) =>
      request<{ ok: boolean }>('DELETE', notifications.registerToken, { body }),
    // In-app notification centre (Stage 5).
    feed: (query?: NotificationsQuery) =>
      request<NotificationFeed>('GET', notifications.list, {
        query: query as Record<string, unknown>,
      }),
    unreadCount: () => request<{ count: number }>('GET', notifications.unreadCount),
    markRead: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', notifications.markRead, { params }),
    markAllRead: () => request<{ ok: boolean }>('POST', notifications.markAllRead),
  },

  subscriptions: {
    list: () => request<GigSubscription[]>('GET', subscriptions.list),
    upsert: (body: UpsertSubscriptionInput) =>
      request<GigSubscription>('POST', subscriptions.upsert, { body }),
    remove: (params: { id: string }) =>
      request<{ ok: boolean }>('DELETE', subscriptions.remove, { params }),
  },

  reports: {
    create: (body: CreateReportInput) => request<{ id: string }>('POST', reports.create, { body }),
  },
}
