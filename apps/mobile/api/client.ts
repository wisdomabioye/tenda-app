import {
  apiConfig,
  apiRoutes,
  type ApiError,
  type AuthResponse,
  type User,
  type WalletAuthBody,
  type UpdateUserInput,
  type PublicUser,
  type Gig,
  type GigDetail,
  type GigProof,
  type CreateGigInput,
  type UpdateGigInput,
  type AcceptGigInput,
  type SubmitProofInput,
  type AddProofsInput,
  type ApproveGigInput,
  type DisputeGigInput,
  type GigListQuery,
  type UserGigsQuery,
  type PaginatedResponse,
  type CloudinarySignature,
  type UploadType,
  type CancelGigInput,
  type RefundExpiredInput,
  type EscrowRequest,
  type EscrowResponse,
  type ApproveEscrowRequest,
  type CancelEscrowRequest,
  type AcceptGigRequest,
  type SubmitProofRequest,
  type RefundExpiredRequest,
  type DisputeGigRequest,
  type WithdrawEarningsRequest,
  type CreateUserAccountRequest,
  type TransactionStatus,
  type Review,
  type ReviewInput,
  type GigTransaction,
  type UserTransaction,
  type GetUserReviewsQuery,
  type PublishGigInput,
  type PlatformConfig,
  type ExchangeRates,
  type Conversation,
  type Message,
  type SendMessageInput,
  type MessagesQuery,
  type GigSubscription,
  type UpsertSubscriptionInput,
  type RegisterDeviceTokenInput,
  type CreateReportInput,
  type ExchangeOfferSummary,
  type ExchangeOfferDetail,
  type ExchangeOffer,
  type ExchangeListQuery,
  type UserTransactionsQuery,
  type UserExchangeOffersQuery,
  type UserExchangeAccount,
  type CreateUserExchangeAccountInput,
  type CreateExchangeOfferInput,
  type ExchangeAcceptInput,
  type ExchangePaidInput,
  type ExchangePublishInput,
  type ExchangeConfirmInput,
  type ExchangeDisputeInput,
  type ExchangeResolveInput,
  type ExchangeCancelInput,
  type ExchangeRefundInput,
  type ExchangeAddProofsInput,
  type ExchangeEscrowRequest,
  type ExchangeAcceptRequest,
  type ExchangeSubmitProofRequest,
  type ExchangeConfirmRequest,
  type ExchangeCancelRequest,
  type ExchangeDisputeRequest,
  type ExchangeRefundRequest,
} from '@tenda/shared'
import { getJwtToken } from '@/lib/secure-store'
import { getEnv } from '@/lib/env'

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string>,
  query?: Record<string, unknown>,
): string {
  let url = `${base}${path}`

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(value))
    }
  }

  if (query) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  return url
}

async function request<TResponse>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, string>
    body?: unknown
    query?: Record<string, unknown>
  },
): Promise<TResponse> {
  const env = getEnv()
  const config = apiConfig[env]
  const url = buildUrl(config.baseUrl, path, options?.params, options?.query)
  const token = await getJwtToken()
  const headers: Record<string, string> = {}

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      const error: ApiError = await response.json()
      throw new ApiClientError(error.statusCode, error.error, error.message)
    }

    return (await response.json()) as TResponse
  } finally {
    clearTimeout(timeoutId)
  }
}

const { auth, gigs, users, upload, blockchain, platform, conversations, notifications, subscriptions, reports, exchange, exchangeAccounts, exchangeBlockchain } = apiRoutes

export const api = {
  auth: {
    wallet: (body: WalletAuthBody) =>
      request<AuthResponse>('POST', auth.wallet, { body }),
    me: () => request<User>('GET', auth.me),
  },

  gigs: {
    list: (query?: GigListQuery) =>
      request<PaginatedResponse<Gig>>('GET', gigs.list, { query: query as Record<string, unknown> }),
    create: (body: CreateGigInput) =>
      request<Gig>('POST', gigs.create, { body }),
    get: (params: { id: string }) =>
      request<GigDetail>('GET', gigs.get, { params }),
    update: (params: { id: string }, body: UpdateGigInput) =>
      request<Gig>('PATCH', gigs.update, { params, body }),
    delete: (params: { id: string }, body?: CancelGigInput) =>
      request<Gig>('DELETE', gigs.delete, { params, body }),
    refund: (params: { id: string }, body: RefundExpiredInput) =>
      request<Gig>('POST', gigs.refund, { params, body }),
    publish: (params: { id: string }, body: PublishGigInput) =>
      request<Gig>('POST', gigs.publish, { params, body }),
    accept: (params: { id: string }, body: AcceptGigInput) =>
      request<Gig>('POST', gigs.accept, { params, body }),
    submit: (params: { id: string }, body: SubmitProofInput) =>
      request<Gig>('POST', gigs.submit, { params, body }),
    addProofs: (params: { id: string }, body: AddProofsInput) =>
      request<GigProof[]>('POST', gigs.addProofs, { params, body }),
    approve: (params: { id: string }, body: ApproveGigInput) =>
      request<Gig>('POST', gigs.approve, { params, body }),
    dispute: (params: { id: string }, body: DisputeGigInput) =>
      request<Gig>('POST', gigs.dispute, { params, body }),
    review: (params: { id: string }, body: ReviewInput) =>
      request<Review>('POST', gigs.review, { params, body }),
    transactions: (params: { id: string }) =>
      request<GigTransaction[]>('GET', gigs.transactions, { params }),
  },

  users: {
    get: (params: { id: string }) =>
      request<PublicUser>('GET', users.get, { params }),
    update: (params: { id: string }, body: UpdateUserInput) =>
      request<User>('PATCH', users.update, { params, body }),
    gigs: (params: { id: string }, query?: UserGigsQuery) =>
      request<PaginatedResponse<Gig>>('GET', users.gigs, {
        params,
        query: query as Record<string, unknown>,
      }),
    reviews: (params: { id: string }, query?: GetUserReviewsQuery) =>
      request<PaginatedResponse<Review>>('GET', users.reviews, {
        params,
        query: query as Record<string, unknown>,
      }),
    transactions: (params: { id: string }, query?: UserTransactionsQuery) =>
      request<PaginatedResponse<UserTransaction>>('GET', users.transactions, {
        params,
        query: query as Record<string, unknown>,
      }),
    exchangeOffers: (params: { id: string }, query?: UserExchangeOffersQuery) =>
      request<PaginatedResponse<ExchangeOfferSummary>>('GET', users.exchangeOffers, {
        params,
        query: query as Record<string, unknown>,
      }),
  },

  upload: {
    signature: (body: { type: UploadType }) =>
      request<CloudinarySignature>('POST', upload.signature, { body }),
  },

  blockchain: {
    transaction: (params: { signature: string }) =>
      request<TransactionStatus>('GET', blockchain.transaction, { params }),
    createEscrow: (body: EscrowRequest) =>
      request<EscrowResponse>('POST', blockchain.createEscrow, { body }),
    approveEscrow: (body: ApproveEscrowRequest) =>
      request<EscrowResponse>('POST', blockchain.approveEscrow, { body }),
    cancelEscrow: (body: CancelEscrowRequest) =>
      request<EscrowResponse>('POST', blockchain.cancelEscrow, { body }),
    acceptGig: (body: AcceptGigRequest) =>
      request<EscrowResponse>('POST', blockchain.acceptGig, { body }),
    submitProof: (body: SubmitProofRequest) =>
      request<EscrowResponse>('POST', blockchain.submitProof, { body }),
    refundExpired: (body: RefundExpiredRequest) =>
      request<EscrowResponse>('POST', blockchain.refundExpired, { body }),
    disputeGig: (body: DisputeGigRequest) =>
      request<EscrowResponse>('POST', blockchain.disputeGig, { body }),
    withdrawEarnings: (body: WithdrawEarningsRequest) =>
      request<EscrowResponse>('POST', blockchain.withdrawEarnings, { body }),
    createUserAccount: (_body: CreateUserAccountRequest) =>
      request<EscrowResponse>('POST', blockchain.createUserAccount, {}),
  },

  platform: {
    config:        () => request<PlatformConfig>('GET', platform.config),
    exchangeRates: () => request<ExchangeRates>('GET', platform.exchangeRates),
  },

  conversations: {
    list: () =>
      request<Conversation[]>('GET', conversations.list),
    findOrCreate: (body: { user_id: string }) =>
      request<Conversation>('POST', conversations.findOrCreate, { body }),
    messages: (params: { id: string }, query?: MessagesQuery) =>
      request<Message[]>('GET', conversations.messages, { params, query: query as Record<string, unknown> }),
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
  },

  subscriptions: {
    list: () =>
      request<GigSubscription[]>('GET', subscriptions.list),
    upsert: (body: UpsertSubscriptionInput) =>
      request<GigSubscription>('POST', subscriptions.upsert, { body }),
    remove: (params: { id: string }) =>
      request<{ ok: boolean }>('DELETE', subscriptions.remove, { params }),
  },

  reports: {
    create: (body: CreateReportInput) =>
      request<{ id: string }>('POST', reports.create, { body }),
  },

  exchangeAccounts: {
    list: () =>
      request<UserExchangeAccount[]>('GET', exchangeAccounts.list),
    create: (body: CreateUserExchangeAccountInput) =>
      request<UserExchangeAccount>('POST', exchangeAccounts.create, { body }),
    deactivate: (params: { id: string }) =>
      request<UserExchangeAccount>('PATCH', exchangeAccounts.deactivate, { params }),
  },

  exchange: {
    list: (query?: ExchangeListQuery) =>
      request<{ data: ExchangeOfferSummary[]; total: number }>('GET', exchange.list, {
        query: query as Record<string, unknown>,
      }),
    create: (body: CreateExchangeOfferInput) =>
      request<ExchangeOfferDetail>('POST', exchange.create, { body }),
    get: (params: { id: string }) =>
      request<ExchangeOfferDetail>('GET', exchange.get, { params }),
    publish: (params: { id: string }, body: ExchangePublishInput) =>
      request<ExchangeOfferDetail>('POST', exchange.publish, { params, body }),
    cancel: (params: { id: string }, body?: ExchangeCancelInput) =>
      request<ExchangeOffer>('DELETE', exchange.cancel, { params, body }),
    accept: (params: { id: string }, body: ExchangeAcceptInput) =>
      request<ExchangeOfferDetail>('POST', exchange.accept, { params, body }),
    paid: (params: { id: string }, body: ExchangePaidInput) =>
      request<ExchangeOffer>('POST', exchange.paid, { params, body }),
    confirm: (params: { id: string }, body: ExchangeConfirmInput) =>
      request<ExchangeOffer>('POST', exchange.confirm, { params, body }),
    dispute: (params: { id: string }, body: ExchangeDisputeInput) =>
      request<ExchangeOffer>('POST', exchange.dispute, { params, body }),
    resolve: (params: { id: string }, body: ExchangeResolveInput) =>
      request<ExchangeOffer>('POST', exchange.resolve, { params, body }),
    refund: (params: { id: string }, body: ExchangeRefundInput) =>
      request<ExchangeOffer>('POST', exchange.refund, { params, body }),
    addProofs: (params: { id: string }, body: ExchangeAddProofsInput) =>
      request<ExchangeOfferDetail>('POST', exchange.addProofs, { params, body }),
    review: (params: { id: string }, body: ReviewInput) =>
      request<Review>('POST', exchange.review, { params, body }),
    update: (params: { id: string }, body: Partial<CreateExchangeOfferInput>) =>
      request<ExchangeOffer>('PATCH', exchange.update, { params, body }),
  },

  exchangeBlockchain: {
    createEscrow: (body: ExchangeEscrowRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.createEscrow, { body }),
    accept: (body: ExchangeAcceptRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.accept, { body }),
    submitProof: (body: ExchangeSubmitProofRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.submitProof, { body }),
    confirm: (body: ExchangeConfirmRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.confirm, { body }),
    cancel: (body: ExchangeCancelRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.cancel, { body }),
    dispute: (body: ExchangeDisputeRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.dispute, { body }),
    refund: (body: ExchangeRefundRequest) =>
      request<EscrowResponse>('POST', exchangeBlockchain.refund, { body }),
  },
}
