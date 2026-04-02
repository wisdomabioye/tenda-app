/**
 * Admin-layer types — derived from the DB schema and used by both the server
 * (route annotations) and the admin frontend. Single source of truth.
 */
import type { InferSelectModel } from 'drizzle-orm'
import {
  platform_config,
  blocked_keywords,
  reports,
  announcements,
  dispute_threads,
  dispute_messages,
  airdrop_campaigns,
  airdrop_recipients,
  airdropStatusEnum,
  airdropRecipientStatusEnum,
  disputeSenderEnum,
} from '../db/schema'
import type { UserRole, UserStatus } from './user'
import type { GigStatus, GigCategory } from './gig'
import type { ExchangeOfferStatus } from './exchange'
import type { ReportStatus } from '../constants/moderation'
import type { PaginatedResponse } from './api'

// ─── DB row types ─────────────────────────────────────────────────────────────

export type AdminPlatformConfig  = InferSelectModel<typeof platform_config>
export type BlockedKeyword       = InferSelectModel<typeof blocked_keywords>
export type Report               = InferSelectModel<typeof reports>
export type Announcement         = InferSelectModel<typeof announcements>
export type DisputeThread        = InferSelectModel<typeof dispute_threads>
export type DisputeMessage       = InferSelectModel<typeof dispute_messages>
export type AirdropCampaign      = InferSelectModel<typeof airdrop_campaigns>
export type AirdropRecipient     = InferSelectModel<typeof airdrop_recipients>

// ─── Enum types ───────────────────────────────────────────────────────────────

export type AirdropStatus         = typeof airdropStatusEnum.enumValues[number]
export type AirdropRecipientStatus = typeof airdropRecipientStatusEnum.enumValues[number]
export type DisputeSender          = typeof disputeSenderEnum.enumValues[number]
export type DisputeType            = 'gig' | 'exchange'

// ─── Admin list rows (custom projections returned by admin list endpoints) ────

export interface AdminGig {
  id:               string
  title:            string
  category:         GigCategory
  status:           GigStatus
  hidden:           boolean
  featured?:        boolean
  country:          string | null
  city:             string | null
  payment_lamports: number
  created_at:       string | null
  poster_id:        string
  poster_first_name: string | null
  poster_last_name:  string | null
}

export interface AdminExchangeOffer {
  id:               string
  status:           ExchangeOfferStatus
  hidden:           boolean
  lamports_amount:  number
  fiat_amount:      number
  fiat_currency:    string
  created_at:       string | null
  seller_id:        string
  seller_first_name: string | null
  seller_last_name:  string | null
}

// ─── Admin list query types ───────────────────────────────────────────────────

export interface AdminGigListQuery {
  offset?:    number
  limit?:     number
  status?:    GigStatus
  hidden?:    boolean
  category?:  GigCategory
  country?:   string
  poster_id?: string
}

export interface AdminExchangeListQuery {
  offset?:   number
  limit?:    number
  status?:   ExchangeOfferStatus
  hidden?:   boolean
  currency?: string
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UpdateUserStatusBody { status: UserStatus }
export interface UpdateUserRoleBody   { role: UserRole }

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ActionReportBody {
  status: ReportStatus
  admin_note?: string
  hide_content?: boolean
}

export type { ReportStatus, PaginatedResponse }

// ─── Gig / Exchange moderation ────────────────────────────────────────────────

export interface HideContentBody { reason?: string }

// ─── Disputes ────────────────────────────────────────────────────────────────

export interface DisputeAssignBody      { assigned_to_id: string | null }
export interface DisputeSendMessageBody { body: string }
export interface DisputeResolveBody     { signature: string; admin_note?: string }
export interface OpenThreadResponse     { thread: DisputeThread; created: boolean }

// ─── Blocked keywords ────────────────────────────────────────────────────────

export interface AddKeywordBody     { keyword: string }
export interface AddKeywordResponse { id: string; keyword: string }

// ─── Platform config ─────────────────────────────────────────────────────────

export interface UpdatePlatformConfigBody {
  fee_bps?: number
  seeker_fee_bps?: number
  grace_period_seconds?: number
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface CreateAnnouncementBody {
  title: string
  body: string
  priority?: number
  is_active?: boolean
  expires_at?: string
}

export interface UpdateAnnouncementBody {
  title?: string
  body?: string
  priority?: number
  is_active?: boolean
  expires_at?: string | null
}

// ─── Push notifications ──────────────────────────────────────────────────────

export type PushBroadcastTarget = 'all' | 'role' | 'country' | 'city'

export interface BroadcastPushBody {
  title: string
  body: string
  target: PushBroadcastTarget
  target_value?: string
  data?: Record<string, string>
}

export interface BroadcastPushResponse { attempted: number }

// ─── Airdrop ─────────────────────────────────────────────────────────────────

export interface CreateAirdropCampaignBody {
  name: string
  lamports_per_recipient: number
  description?: string
  batch_size?: number
}

export interface AddAirdropRecipientsBody     { wallets: string[] }
export interface AddAirdropRecipientsResponse { added: number; skipped_duplicates: number }

export interface AirdropBatchSummary {
  batch_index: number
  total: number
  pending: number
  distributed: number
  failed: number
  skipped: number
}

export interface BuildBatchResponse    { transaction: string; recipient_count: number }
export interface ConfirmBatchBody      { signature: string }
export interface ConfirmBatchResponse  { distributed: number }

// ─── Finance ─────────────────────────────────────────────────────────────────

export type FinanceLedgerType = 'gig' | 'exchange'

export interface FinanceFeeRow {
  type: string
  transaction_count: number
  total_platform_fee: string
  total_amount: string
}

export interface FinanceFeeSummary {
  by_type: FinanceFeeRow[]
  total_fee_lamports: string
}

export interface FinanceFeesResponse {
  period: { from: string; to: string }
  gig: FinanceFeeSummary
  exchange: FinanceFeeSummary
  grand_total_fee_lamports: string
}
