import type {
  AuthResponse,
  WalletAuthBody,
  User,
  AdminGig,
  AdminExchangeOffer,
  AdminGigListQuery,
  AdminExchangeListQuery,
  PaginatedResponse,
  AdminPlatformConfig,
  BlockedKeyword,
  Report,
  Announcement,
  DisputeThread,
  DisputeMessage,
  DisputeSummary,
  AirdropCampaign,
  AirdropCampaignDetail,
  AirdropStatus,
  AirdropBatchSummary,
  UpdateUserStatusBody,
  UpdateUserRoleBody,
  HideContentBody,
  ActionReportBody,
  DisputeAssignBody,
  DisputeSendMessageBody,
  DisputeResolveBody,
  OpenThreadResponse,
  AddKeywordBody,
  AddKeywordResponse,
  UpdatePlatformConfigBody,
  CreateAnnouncementBody,
  UpdateAnnouncementBody,
  BroadcastPushBody,
  BroadcastPushResponse,
  CreateAirdropCampaignBody,
  AddAirdropRecipientsBody,
  AddAirdropRecipientsResponse,
  BuildBatchResponse,
  ConfirmBatchBody,
  ConfirmBatchResponse,
  FinanceFeesResponse,
  DisputeType,
} from '@tenda/shared'
import type { GigDetail, ExchangeOfferDetail } from '@tenda/shared'
import { adminRoutes, apiRoutes } from '@/api/routes'
import { getToken, clearToken } from '@/lib/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string>,
  query?: Record<string, unknown>,
): string {
  let url = `${BASE_URL}${path}`

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

async function request<T>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, string>
    body?: unknown
    query?: Record<string, unknown>
  },
): Promise<T> {
  const url     = buildUrl(path, options?.params, options?.query)
  const token   = getToken()
  const headers: Record<string, string> = {}

  if (options?.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { code?: string; message?: string }
    throw new ApiError(res.status, err.code ?? 'API_ERROR', err.message ?? `Request failed: ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface AdminListQuery {
  offset?: number
  limit?:  number
  search?: string
  status?: string
  role?:   string
}

export interface AdminReportListQuery {
  offset?:       number
  limit?:        number
  status?:       string
  content_type?: string
}

export interface FinanceFeesQuery {
  from?: string
  to?:   string
}

export interface FinanceTxQuery {
  type:     'gig' | 'exchange'  // required by server
  from?:    string
  to?:      string
  tx_type?: string
  offset?:  number
  limit?:   number
}

export const adminApi = {
  auth: {
    wallet: (body: WalletAuthBody) =>
      request<AuthResponse>('POST', apiRoutes.auth.wallet, { body }),
  },

  users: {
    list: (query?: AdminListQuery) =>
      request<PaginatedResponse<User>>('GET', adminRoutes.users.list, { query: query as Record<string, unknown> }),
    get: (params: { id: string }) =>
      request<User>('GET', adminRoutes.users.get, { params }),
    updateStatus: (params: { id: string }, body: UpdateUserStatusBody) =>
      request<User>('PATCH', adminRoutes.users.updateStatus, { params, body }),
    updateRole: (params: { id: string }, body: UpdateUserRoleBody) =>
      request<User>('PATCH', adminRoutes.users.updateRole, { params, body }),
  },

  gigs: {
    list: (query?: AdminGigListQuery) =>
      request<PaginatedResponse<AdminGig>>('GET', adminRoutes.gigs.list, { query: query as Record<string, unknown> }),
    get: (params: { id: string }) =>
      request<GigDetail>('GET', adminRoutes.gigs.get, { params }),
    hide: (params: { id: string }, body?: HideContentBody) =>
      request<{ ok: boolean }>('POST', adminRoutes.gigs.hide, { params, body }),
    unhide: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', adminRoutes.gigs.unhide, { params }),
    expire: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', adminRoutes.gigs.expire, { params }),
    feature: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', adminRoutes.gigs.feature, { params }),
    unfeature: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', adminRoutes.gigs.unfeature, { params }),
  },

  exchange: {
    list: (query?: AdminExchangeListQuery) =>
      request<PaginatedResponse<AdminExchangeOffer>>('GET', adminRoutes.exchange.list, { query: query as Record<string, unknown> }),
    get: (params: { id: string }) =>
      request<ExchangeOfferDetail>('GET', adminRoutes.exchange.get, { params }),
    hide: (params: { id: string }, body?: HideContentBody) =>
      request<{ ok: boolean }>('POST', adminRoutes.exchange.hide, { params, body }),
    unhide: (params: { id: string }) =>
      request<{ ok: boolean }>('POST', adminRoutes.exchange.unhide, { params }),
  },

  reports: {
    list: (query?: AdminReportListQuery) =>
      request<PaginatedResponse<Report>>('GET', adminRoutes.reports.list, { query: query as Record<string, unknown> }),
    action: (params: { id: string }, body: ActionReportBody) =>
      request<Report>('PATCH', adminRoutes.reports.action, { params, body }),
  },

  disputes: {
    list: (query?: AdminListQuery) =>
      request<PaginatedResponse<DisputeSummary>>('GET', adminRoutes.disputes.list, { query: query as Record<string, unknown> }),
    get: (params: { type: DisputeType; id: string }) =>
      request<DisputeThread>('GET', adminRoutes.disputes.get, { params }),
    openThread: (params: { type: DisputeType; id: string }) =>
      request<OpenThreadResponse>('POST', adminRoutes.disputes.openThread, { params }),
    getThread: (params: { type: DisputeType; id: string }) =>
      request<DisputeThread>('GET', adminRoutes.disputes.getThread, { params }),
    sendMessage: (params: { type: DisputeType; id: string }, body: DisputeSendMessageBody) =>
      request<DisputeMessage>('POST', adminRoutes.disputes.sendMessage, { params, body }),
    assign: (params: { type: DisputeType; id: string }, body: DisputeAssignBody) =>
      request<DisputeThread>('PATCH', adminRoutes.disputes.assignThread, { params, body }),
    resolve: (params: { type: DisputeType; id: string }, body: DisputeResolveBody) =>
      request<{ ok: boolean }>('POST', adminRoutes.disputes.resolve, { params, body }),
  },

  keywords: {
    list: (query?: { offset?: number; limit?: number }) =>
      request<PaginatedResponse<BlockedKeyword>>('GET', adminRoutes.keywords.list, { query: query as Record<string, unknown> }),
    add: (body: AddKeywordBody) =>
      request<AddKeywordResponse>('POST', adminRoutes.keywords.add, { body }),
    remove: (params: { id: string }) =>
      request<{ ok: boolean }>('DELETE', adminRoutes.keywords.remove, { params }),
    refresh: () =>
      request<{ ok: boolean }>('POST', adminRoutes.keywords.refresh),
  },

  config: {
    get: () =>
      request<AdminPlatformConfig>('GET', adminRoutes.config.get),
    update: (body: UpdatePlatformConfigBody) =>
      request<AdminPlatformConfig>('PATCH', adminRoutes.config.update, { body }),
  },

  announcements: {
    list: () =>
      request<Announcement[]>('GET', adminRoutes.announcements.list),
    get: (params: { id: string }) =>
      request<Announcement>('GET', adminRoutes.announcements.get, { params }),
    create: (body: CreateAnnouncementBody) =>
      request<Announcement>('POST', adminRoutes.announcements.create, { body }),
    update: (params: { id: string }, body: UpdateAnnouncementBody) =>
      request<Announcement>('PATCH', adminRoutes.announcements.update, { params, body }),
    remove: (params: { id: string }) =>
      request<{ ok: boolean }>('DELETE', adminRoutes.announcements.remove, { params }),
  },

  push: {
    broadcast: (body: BroadcastPushBody) =>
      request<BroadcastPushResponse>('POST', adminRoutes.push.broadcast, { body }),
  },

  airdrop: {
    list: (query?: { status?: AirdropStatus; offset?: number; limit?: number }) =>
      request<PaginatedResponse<AirdropCampaign>>('GET', adminRoutes.airdrop.list, { query: query as Record<string, unknown> }),
    get: (params: { id: string }) =>
      request<AirdropCampaignDetail>('GET', adminRoutes.airdrop.get, { params }),
    create: (body: CreateAirdropCampaignBody) =>
      request<AirdropCampaign>('POST', adminRoutes.airdrop.create, { body }),
    addRecipients: (params: { id: string }, body: AddAirdropRecipientsBody) =>
      request<AddAirdropRecipientsResponse>('POST', adminRoutes.airdrop.addRecipients, { params, body }),
    approve: (params: { id: string }) =>
      request<AirdropCampaign>('POST', adminRoutes.airdrop.approve, { params }),
    buildBatch: (params: { id: string; batchIndex: string }, query: { treasury: string }) =>
      request<BuildBatchResponse>('GET', adminRoutes.airdrop.buildBatch, { params, query }),
    confirmBatch: (params: { id: string; batchIndex: string }, body: ConfirmBatchBody) =>
      request<ConfirmBatchResponse>('POST', adminRoutes.airdrop.confirmBatch, { params, body }),
  },

  finance: {
    fees: (query?: FinanceFeesQuery) =>
      request<FinanceFeesResponse>('GET', adminRoutes.finance.fees, { query: query as Record<string, unknown> }),
    transactions: (query: FinanceTxQuery) =>
      request<PaginatedResponse<Record<string, unknown>>>('GET', adminRoutes.finance.transactions, { query: query as unknown as Record<string, unknown> }),
  },
}
