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
  type Conversation,
  type Message,
  type SendMessageInput,
  type MessagesQuery,
  type GigSubscription,
  type UpsertSubscriptionInput,
  type RegisterDeviceTokenInput,
  type CreateReportInput,
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

const { auth, gigs, users, upload, blockchain, platform, conversations, notifications, subscriptions, reports } = apiRoutes

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
    transactions: (params: { id: string }) =>
      request<UserTransaction[]>('GET', users.transactions, { params }),
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
    config: () => request<PlatformConfig>('GET', platform.config),
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
}
